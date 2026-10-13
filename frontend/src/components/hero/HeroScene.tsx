import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, Line, Stars, useTexture } from '@react-three/drei'
import {
  AdditiveBlending,
  BackSide,
  Color,
  Group,
  Mesh,
  QuadraticBezierCurve3,
  SRGBColorSpace,
  Vector3,
  type Texture,
} from 'three'
import type { Line2 } from 'three-stdlib'
import { asset } from '@/lib/asset'
import { angleDelta, centroid, faceCamera, latLonToVec3 } from './geo'

export interface HeroSite {
  id: string
  name: string
  lat: number
  lon: number
  score: number
  rank: number
  role: 'documented' | 'candidate' | 'control'
}

export interface HeroTarget {
  id: string
  body: 'mars' | 'moon'
  short: string
  lat: number
  lon: number
  top: HeroSite[] // best Earth matches, ranked
}

interface Props {
  targets: HeroTarget[]
  allSites: { id: string; lat: number; lon: number; role: HeroSite['role'] }[]
  screened: { lat: number; lon: number }[]
  selected: string
  hovered: string | null
  onSelect: (id: string) => void
  onHoverSite: (id: string | null) => void
  onOpenSite: (targetId: string, siteId: string) => void
  onInteract: () => void
  onReady?: () => void
  reduced: boolean
  active: boolean
}

const COLORS = {
  data: new Color('#7fd8e6'),
  derived: new Color('#a99fdc'),
  control: new Color('#7d8b9c'),
  amber: new Color('#f0bb6e'),
  mars: new Color('#d9785a'),
  moon: new Color('#c9d3de'),
  screen: new Color('#e7a1c9'),
}
const MARS_HAZE = new Color('#f0a882')
const ROLE_COLOR = { documented: COLORS.data, candidate: COLORS.derived, control: COLORS.control }
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

/* ----------------------------------------------------------------------------------------------- layout */

interface Layout {
  earth: [number, number, number]
  earthR: number
  mars: [number, number, number]
  marsR: number
  moon: [number, number, number]
  moonR: number
  camZ: number
  look: [number, number, number]
  labels: boolean
}

function useLayout(): Layout {
  const { size } = useThree()
  const aspect = size.width / size.height
  if (aspect < 1.1) {
    // portrait (phones, tablets): worlds in the top half, text below
    const camZ = Math.max(12.2, 2.05 / (0.344 * aspect))
    return { earth: [0, 2.45, 0], earthR: 1.05, mars: [-1.2, 4.15, -1], marsR: 0.36, moon: [1.25, 4.05, -0.6], moonR: 0.28, camZ, look: [0, 0.6, 0], labels: false }
  }
  // Landscape: place worlds by screen fraction so wide monitors have no empty right side.
  // Earth centres over the match dock (bottom right), Mars to its right, the Moon to its upper left.
  const camZ = aspect < 1.45 ? 10.5 : 9.2
  const half = (z: number) => (camZ - z) * Math.tan((19 * Math.PI) / 180)
  const X = (f: number, z = 0) => (2 * f - 1) * half(z) * aspect
  const Y = (f: number, z = 0) => (1 - 2 * f) * half(z)
  const dockCentre = 1 - (32 + Math.min(860, 0.58 * size.width) / 2) / size.width
  const ex = Math.min(0.76, Math.max(0.66, dockCentre - 0.01))
  const h0 = half(0)
  return {
    earth: [X(ex), Y(0.4), 0],
    earthR: h0 * (aspect > 1.9 ? 0.45 : 0.42),
    mars: [X(Math.min(0.935, ex + 0.235), -1.5), Y(0.17, -1.5), -1.5],
    marsR: h0 * 0.17,
    moon: [X(ex - 0.2, -1.5), Y(0.15, -1.5), -1.5],
    moonR: h0 * 0.125,
    camZ,
    look: [0, 0, 0],
    labels: true,
  }
}

/* -------------------------------------------------------------------------------------- atmosphere */

const atmoVertex = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const atmoFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uStrength;
  varying vec3 vNormal;
  void main() {
    float i = pow(max(0.0, 0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0))), uPower) * uStrength;
    gl_FragColor = vec4(uColor, 1.0) * i;
  }
`

function Atmosphere({ radius, color, strength = 1.2, power = 3, scale = 1.14 }: { radius: number; color: Color; strength?: number; power?: number; scale?: number }) {
  const uniforms = useMemo(() => ({ uColor: { value: color }, uPower: { value: power }, uStrength: { value: strength } }), [color, power, strength])
  return (
    <mesh scale={radius * scale}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial vertexShader={atmoVertex} fragmentShader={atmoFragment} uniforms={uniforms} blending={AdditiveBlending} side={BackSide} transparent depthWrite={false} />
    </mesh>
  )
}

/* ------------------------------------------------------------------------------------------ markers */

/** A pulsing ring that lies flat on a sphere at the given unit-sphere position. */
function PulseRing({ position, color, size, phase = 0, strong = false }: { position: Vector3; color: Color; size: number; phase?: number; strong?: boolean }) {
  const ref = useRef<Mesh>(null)
  const normal = useMemo(() => position.clone().normalize().multiplyScalar(2).add(position), [position])
  useEffect(() => ref.current?.lookAt(normal), [normal])
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = (clock.elapsedTime * 0.8 + phase) % 1
    m.scale.setScalar(size * (1 + t * (strong ? 2.6 : 1.8)))
    ;(m.material as { opacity: number }).opacity = (1 - t) * (strong ? 0.9 : 0.55)
  })
  return (
    <mesh ref={ref} position={position}>
      <ringGeometry args={[0.8, 1, 48]} />
      <meshBasicMaterial color={color} transparent depthWrite={false} />
    </mesh>
  )
}

/* -------------------------------------------------------------------------------------------- arcs */

const ARC_POINTS = 64

/**
 * A glowing arc from a point on the target world to an Earth site. Both ends are read in world space
 * every frame, so the arc follows the spinning globes. It draws itself in, then a spark travels along it.
 */
function Arc({
  from,
  to,
  color,
  delay,
  highlight,
  dim,
  startedAt,
  reduced,
}: {
  from: { group: React.RefObject<Group | null>; local: Vector3 | undefined }
  to: { group: React.RefObject<Group | null>; local: Vector3 | undefined }
  color: Color
  delay: number
  highlight: boolean
  dim: boolean
  startedAt: React.RefObject<number>
  reduced: boolean
}) {
  const line = useRef<Line2>(null)
  const spark = useRef<Mesh>(null)
  // per-arc scratch objects live in a ref: they are mutated every frame
  const scratch = useRef({
    curve: new QuadraticBezierCurve3(new Vector3(), new Vector3(), new Vector3()),
    buf: new Float32Array(ARC_POINTS * 3),
    p: new Vector3(),
    a: new Vector3(),
    b: new Vector3(),
    mid: new Vector3(),
  })
  const initial = useMemo(() => Array.from({ length: ARC_POINTS }, () => new Vector3()), [])

  useFrame(({ clock }) => {
    const l = line.current
    const fg = from.group.current
    const tg = to.group.current
    if (!l || !fg || !tg || !from.local || !to.local) return
    const { curve, buf, p, mid } = scratch.current
    const a = fg.localToWorld(scratch.current.a.copy(from.local))
    const b = tg.localToWorld(scratch.current.b.copy(to.local))
    mid.copy(a).add(b).multiplyScalar(0.5)
    const lift = a.distanceTo(b) * 0.38
    mid.z += lift
    mid.y += lift * 0.35
    curve.v0.copy(a)
    curve.v1.copy(mid)
    curve.v2.copy(b)
    const t = reduced ? 1 : easeOut((clock.elapsedTime - (startedAt.current ?? 0) - delay) / 1.3)
    const n = Math.max(2, Math.round(t * (ARC_POINTS - 1)) + 1)
    for (let i = 0; i < ARC_POINTS; i++) {
      curve.getPoint(Math.min(i, n - 1) / (ARC_POINTS - 1), p)
      buf[i * 3] = p.x
      buf[i * 3 + 1] = p.y
      buf[i * 3 + 2] = p.z
    }
    l.geometry.setPositions(buf)
    const mat = l.material as { opacity: number; linewidth: number }
    mat.opacity = t <= 0 ? 0 : dim ? 0.18 : highlight ? 1 : 0.7
    mat.linewidth = highlight ? 2.6 : 1.4
    const s = spark.current
    if (s) {
      const visible = t >= 1 && !dim && !reduced
      s.visible = visible
      if (visible) {
        const u = (clock.elapsedTime * 0.42 + delay * 1.7) % 1
        curve.getPoint(u, s.position)
        s.scale.setScalar((highlight ? 0.05 : 0.032) * (0.6 + Math.sin(u * Math.PI) * 0.8))
      }
    }
  })

  return (
    <>
      <Line ref={line} points={initial} color={color} lineWidth={1.4} transparent opacity={0} depthWrite={false} toneMapped={false} />
      <mesh ref={spark} visible={false}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </>
  )
}

/* ------------------------------------------------------------------------------------------ worlds */

function useWorldTextures() {
  const [earth, mars, moon] = useTexture([asset('media/earth-2k.webp'), asset('media/mars-2k.webp'), asset('media/moon-2k.webp')]) as Texture[]
  useLayoutEffect(() => {
    for (const t of [earth, mars, moon]) {
      t!.colorSpace = SRGBColorSpace
      t!.anisotropy = 8
      t!.needsUpdate = true
    }
  }, [earth, mars, moon])
  return { earth: earth!, mars: mars!, moon: moon! }
}

interface Spin {
  vel: number
  user: number
  dragging: boolean
}

function Scene(props: Props) {
  const { targets, allSites, screened, selected, hovered, onSelect, onHoverSite, onOpenSite, reduced } = props
  const L = useLayout()
  const tex = useWorldTextures()
  const { camera, pointer } = useThree()

  const earth = useRef<Group>(null)
  const earthSpin = useRef<Group>(null)
  const marsGroup = useRef<Group>(null)
  const moonGroup = useRef<Group>(null)
  const marsSpin = useRef<Group>(null)
  const moonSpin = useRef<Group>(null)
  const [hoverWorld, setHoverWorld] = useState<string | null>(null)
  const startedAt = useRef(0)
  const introAt = useRef<number | null>(null)
  const spin = useRef<Spin>({ vel: 0, user: 0, dragging: false })
  const onInteract = useRef(props.onInteract)
  useEffect(() => {
    onInteract.current = props.onInteract
  })
  const labelRefs = useRef(new Map<string, HTMLDivElement | null>())
  const worldLabels = useRef<Record<'mars' | 'moon', HTMLDivElement | null>>({ mars: null, moon: null })
  // textures are loaded once Scene mounts (useTexture suspends until then)
  const onReady = useRef(props.onReady)
  useEffect(() => onReady.current?.(), [])

  const target = targets.find((t) => t.id === selected) ?? targets[0]
  const top = useMemo(() => target?.top.slice(0, 5) ?? [], [target])
  const topIds = useMemo(() => new Set(top.map((s) => s.id)), [top])
  const facing = useMemo(() => {
    if (!top.length) return { x: 0.3, y: 1.6 }
    const c = centroid(top)
    const f = faceCamera(c.lat, c.lon, 0.55)
    return { x: f.x, y: f.y + 0.35 } // nudge sites toward the worlds on the right
  }, [top])

  // restart the arc draw-in whenever the target changes
  useEffect(() => {
    startedAt.current = -1 // set on next frame from the clock
    spin.current.user *= 0.3
  }, [selected])

  // drag to spin Earth (horizontal only, so vertical swipes still scroll the page on phones)
  const { gl } = useThree()
  useEffect(() => {
    const el = gl.domElement
    let lastX = 0
    let lastT = 0
    const down = (e: PointerEvent) => {
      spin.current.dragging = true
      lastX = e.clientX
      lastT = performance.now()
      onInteract.current()
    }
    const move = (e: PointerEvent) => {
      if (!spin.current.dragging) return
      const dx = e.clientX - lastX
      const now = performance.now()
      spin.current.user += dx * 0.006
      spin.current.vel = (dx * 0.006) / Math.max(1, now - lastT) * 16
      lastX = e.clientX
      lastT = now
    }
    const up = () => (spin.current.dragging = false)
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl])

  const tmpA = useMemo(() => new Vector3(), [])
  const tmpB = useMemo(() => new Vector3(), [])
  const camTarget = useMemo(() => new Vector3(), [])

  // surface positions (unit sphere, scaled by the parent group)
  const sitePos = useMemo(() => new Map(allSites.map((s) => [s.id, latLonToVec3(s.lat, s.lon, 1.006)])), [allSites])
  const screenedPos = useMemo(() => {
    const arr = new Float32Array(screened.length * 3)
    screened.forEach((s, i) => latLonToVec3(s.lat, s.lon, 1.004).toArray(arr, i * 3))
    return arr
  }, [screened])
  const refPos = useMemo(() => new Map(targets.map((t) => [t.id, latLonToVec3(t.lat, t.lon, 1.01)])), [targets])
  const worldFacing = useMemo(
    () =>
      Object.fromEntries(
        targets.map((t) => {
          const f = faceCamera(t.lat, t.lon, t.body === 'moon' ? 0.42 : 0.8)
          return [t.body, { x: f.x, y: f.y - 0.5 }] // turn the reference point slightly toward Earth
        }),
      ) as Record<'mars' | 'moon', { x: number; y: number }>,
    [targets],
  )

  useFrame(({ clock }, dt) => {
    const now = clock.elapsedTime
    if (introAt.current === null) introAt.current = now
    if (startedAt.current < 0) startedAt.current = now + (now - introAt.current < 1 ? 1.6 : 0.25)
    const intro = reduced ? 1 : easeOut((now - introAt.current) / 2.6)

    // camera: dolly in on load, then drift with the pointer
    camTarget.set(L.look[0] + pointer.x * 0.35, L.look[1] + pointer.y * 0.22, L.camZ + (1 - intro) * 9)
    camera.position.lerp(camTarget, reduced ? 1 : 0.06)
    camera.lookAt(L.look[0], L.look[1], L.look[2])

    // Earth: ease toward facing the matched sites, plus the user's spin with inertia
    const s = spin.current
    if (!s.dragging) {
      s.user += s.vel
      s.vel *= 0.94
      if (Math.abs(s.vel) < 0.0004) s.user *= reduced ? 1 : 0.995 // slowly return to the sites
    }
    const g = earthSpin.current
    if (g) {
      const idle = reduced ? 0 : Math.sin(now * 0.12) * 0.08
      const goalY = facing.y + s.user + idle - (1 - intro) * 1.6
      g.rotation.y += angleDelta(g.rotation.y, goalY) * Math.min(1, dt * 2.2)
      g.rotation.x += (facing.x - g.rotation.x) * Math.min(1, dt * 2.2)
    }
    if (earth.current) earth.current.scale.setScalar(L.earthR * (0.6 + 0.4 * intro))

    // Mars and the Moon: float, face their reference point, grow on hover
    for (const body of ['mars', 'moon'] as const) {
      const grp = (body === 'mars' ? marsGroup : moonGroup).current
      const sp = (body === 'mars' ? marsSpin : moonSpin).current
      if (!grp || !sp) continue
      const base = body === 'mars' ? L.mars : L.moon
      const r = body === 'mars' ? L.marsR : L.moonR
      const isSel = target?.body === body
      const hov = hoverWorld === body
      const appear = reduced ? 1 : easeOut((now - (introAt.current ?? 0) - (body === 'mars' ? 0.5 : 0.75)) / 1.6)
      grp.position.set(base[0] + (1 - appear) * 3, base[1] + Math.sin(now * 0.5 + (body === 'mars' ? 0 : 2)) * 0.06, base[2])
      const goal = r * appear * (hov ? 1.12 : isSel ? 1.05 : 0.92)
      grp.scale.setScalar(grp.scale.x + (goal - grp.scale.x) * Math.min(1, dt * 6))
      const f = worldFacing[body]
      sp.rotation.x += (f.x - sp.rotation.x) * Math.min(1, dt * 1.5)
      sp.rotation.y += angleDelta(sp.rotation.y, f.y + (reduced ? 0 : Math.sin(now * 0.09) * 0.12)) * Math.min(1, dt * 1.5)
      const label = worldLabels.current[body]
      if (label) label.style.opacity = String(Math.max(0, (appear - 0.6) / 0.4))
    }

    // site labels: fade out when on the far side of Earth
    if (earthSpin.current) {
      for (const [id, el] of labelRefs.current) {
        const p = sitePos.get(id)
        if (!el || !p) continue
        tmpA.copy(p)
        earthSpin.current.localToWorld(tmpA)
        tmpB.copy(tmpA).sub(earthSpin.current.getWorldPosition(new Vector3())).normalize()
        const toCam = camera.position.clone().sub(tmpA).normalize()
        const vis = Math.max(0, Math.min(1, (tmpB.dot(toCam) - 0.05) * 5))
        el.style.opacity = String(vis * Math.min(1, Math.max(0, (intro - 0.8) / 0.2)))
        el.style.pointerEvents = vis > 0.5 ? 'auto' : 'none'
      }
    }
  })

  const worldEvents = (t: HeroTarget) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      setHoverWorld(t.body)
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      setHoverWorld(null)
      document.body.style.cursor = ''
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      props.onInteract()
      onSelect(t.id)
    },
  })

  return (
    <>
      {/* key light sits just left of the camera so every visible face is lit; a cool rim light adds depth */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[-3, 2.5, 8]} intensity={2.1} color="#fff8ef" />
      <directionalLight position={[6, 1, -6]} intensity={0.6} color="#9fdcff" />
      <Stars radius={80} depth={40} count={reduced ? 1500 : 4000} factor={3.2} saturation={0} fade speed={reduced ? 0 : 0.6} />

      {/* Earth */}
      <group ref={earth} position={L.earth}>
        <group ref={earthSpin} rotation={[facing.x, facing.y - 1.6, 0]}>
          <mesh>
            <sphereGeometry args={[1, 96, 96]} />
            <meshStandardMaterial map={tex.earth} emissiveMap={tex.earth} emissive="#ffffff" emissiveIntensity={0.12} roughness={0.85} metalness={0.05} />
          </mesh>
          {/* every curated site, faint */}
          {allSites.map((s) =>
            topIds.has(s.id) ? null : (
              <mesh key={s.id} position={sitePos.get(s.id)} scale={0.011}>
                <sphereGeometry args={[1, 10, 10]} />
                <meshBasicMaterial color={ROLE_COLOR[s.role]} transparent opacity={0.55} toneMapped={false} />
              </mesh>
            ),
          )}
          {/* screened windows */}
          {screened.length > 0 && (
            <points>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[screenedPos, 3]} />
              </bufferGeometry>
              <pointsMaterial color={COLORS.screen} size={0.018} sizeAttenuation transparent opacity={0.75} depthWrite={false} toneMapped={false} />
            </points>
          )}
          {/* best matches for the selected target */}
          {top.map((s, i) => {
            const p = sitePos.get(s.id)
            if (!p) return null
            const isHover = hovered === s.id
            return (
              <group key={`${selected}-${s.id}`}>
                <mesh
                  position={p}
                  scale={isHover ? 0.03 : 0.022}
                  onPointerOver={(e) => {
                    e.stopPropagation()
                    onHoverSite(s.id)
                    document.body.style.cursor = 'pointer'
                  }}
                  onPointerOut={() => {
                    onHoverSite(null)
                    document.body.style.cursor = ''
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenSite(selected, s.id)
                  }}
                >
                  <sphereGeometry args={[1, 16, 16]} />
                  <meshBasicMaterial color={ROLE_COLOR[s.role]} toneMapped={false} />
                </mesh>
                <PulseRing position={p} color={ROLE_COLOR[s.role]} size={isHover ? 0.05 : 0.034} phase={i * 0.2} strong={isHover} />
                {L.labels && (i < 3 || isHover) && <Html position={p} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
                  <div
                    ref={(el) => {
                      labelRefs.current.set(s.id, el)
                    }}
                    className="pointer-events-auto -translate-y-1/2 translate-x-3 cursor-pointer select-none whitespace-nowrap rounded-md border border-white/10 bg-ink-950/75 px-2 py-1 font-mono text-[10px] text-slate-200 opacity-0 backdrop-blur-sm transition-[background-color,border-color]"
                    style={{ borderColor: isHover ? 'rgb(127 216 230 / 0.7)' : undefined }}
                    onPointerEnter={() => onHoverSite(s.id)}
                    onPointerLeave={() => onHoverSite(null)}
                    onClick={() => onOpenSite(selected, s.id)}
                  >
                    <span className="text-slate-400">#{s.rank}</span> {s.name.split(',')[0]} <span className="text-data">{Math.round(s.score * 100)}/100</span>
                  </div>
                </Html>}
              </group>
            )
          })}
        </group>
        <Atmosphere radius={1} color={COLORS.data} strength={0.55} power={4.6} scale={1.08} />
      </group>

      {/* Mars and the Moon */}
      {targets.map((t) => {
        const body = t.body
        const isSel = t.id === selected
        return (
          <group key={t.id} ref={body === 'mars' ? marsGroup : moonGroup} scale={0.001} {...worldEvents(t)}>
            <group ref={body === 'mars' ? marsSpin : moonSpin}>
              <mesh>
                <sphereGeometry args={[1, 64, 64]} />
                <meshStandardMaterial
                  map={body === 'mars' ? tex.mars : tex.moon}
                  emissiveMap={body === 'mars' ? tex.mars : tex.moon}
                  emissive="#ffffff"
                  emissiveIntensity={body === 'mars' ? 0.28 : 0.32}
                  roughness={1}
                  metalness={0}
                />
              </mesh>
              <mesh position={refPos.get(t.id)} scale={0.045}>
                <sphereGeometry args={[1, 12, 12]} />
                <meshBasicMaterial color={COLORS.amber} toneMapped={false} />
              </mesh>
              {isSel && <PulseRing position={refPos.get(t.id)!} color={COLORS.amber} size={0.07} strong />}
            </group>
            {body === 'mars' && <Atmosphere radius={1} color={MARS_HAZE} strength={0.16} power={5.5} scale={1.05} />}
            {/* invisible, larger hit area so small worlds are easy to tap */}
            <mesh scale={1.35} visible={false}>
              <sphereGeometry args={[1, 12, 12]} />
            </mesh>
            <Html position={[0, -1.32, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <div
                ref={(el) => {
                  worldLabels.current[body] = el
                }}
                className="select-none whitespace-nowrap text-center opacity-0"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: body === 'mars' ? '#d9785a' : '#c9d3de' }}>
                  {body === 'mars' ? 'Mars' : 'Moon'}
                </p>
                <p className={`text-[11px] transition-colors ${isSel ? 'text-slate-100' : 'text-slate-400'}`}>{t.short}</p>
              </div>
            </Html>
          </group>
        )
      })}

      {/* arcs from the selected target's reference point to its best Earth matches */}
      {target &&
        top.map((s, i) => (
          <Arc
            key={`${target.id}-${s.id}`}
            from={{ group: target.body === 'mars' ? marsSpin : moonSpin, local: refPos.get(target.id) }}
            to={{ group: earthSpin, local: sitePos.get(s.id) }}
            color={i === 0 ? COLORS.amber : ROLE_COLOR[s.role]}
            delay={i * 0.18}
            highlight={hovered === s.id}
            dim={hovered !== null && hovered !== s.id}
            startedAt={startedAt}
            reduced={reduced}
          />
        ))}
    </>
  )
}

/** Full-bleed WebGL hero: Earth, Mars and the Moon with live analog links. Lazy-loaded. */
export default function HeroScene(props: Props) {
  return (
    <Canvas
      className="!absolute inset-0"
      style={{ touchAction: 'pan-y' }}
      flat
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 18], fov: 38, near: 0.1, far: 300 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      frameloop={props.active ? 'always' : 'never'}
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  )
}


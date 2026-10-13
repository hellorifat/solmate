import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { MoveHorizontal } from 'lucide-react'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/utils'

type View = 'hillshade' | 'slope' | 'imagery'

interface Props {
  left: { label: string; sub: string; quicklooks: Partial<Record<View, string>>; accent: string }
  right: { label: string; sub: string; quicklooks: Partial<Record<View, string>>; accent: string }
  view: View
}

/**
 * Drag (or use arrow keys) to wipe between two 20 km windows rendered at the same 100 m scale.
 * The wipe nudges itself once on first view so the interaction is discoverable.
 */
export function CompareSlider({ left, right, view }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(0.5)
  const [dragging, setDragging] = useState(false)
  const reduced = useReducedMotion()
  const [hinted, setHinted] = useState(false)

  const setFromClient = useCallback((clientX: number) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setPos(Math.min(0.98, Math.max(0.02, (clientX - r.left) / r.width)))
  }, [])

  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => setFromClient(e.clientX)
    const up = () => setDragging(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [dragging, setFromClient])

  const leftSrc = left.quicklooks[view] ?? left.quicklooks.hillshade
  const rightSrc = right.quicklooks[view] ?? right.quicklooks.hillshade

  return (
    <motion.div
      ref={ref}
      className="relative aspect-square w-full touch-none select-none overflow-hidden rounded-2xl border border-border bg-ink-950 sm:aspect-[4/3]"
      onPointerDown={(e) => {
        setDragging(true)
        setFromClient(e.clientX)
      }}
      onViewportEnter={() => {
        if (hinted || reduced) return
        setHinted(true)
        // gentle discoverability nudge
        setTimeout(() => setPos(0.62), 300)
        setTimeout(() => setPos(0.42), 900)
        setTimeout(() => setPos(0.5), 1500)
      }}
    >
      {rightSrc && <img src={asset(rightSrc)} alt={`${right.label} terrain`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos * 100}% 0 0)`, transition: dragging ? 'none' : 'clip-path 600ms cubic-bezier(0.16,1,0.3,1)' }}>
        {leftSrc && <img src={asset(leftSrc)} alt={`${left.label} terrain`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
      </div>

      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos * 100}%`, transition: dragging ? 'none' : 'left 600ms cubic-bezier(0.16,1,0.3,1)' }}>
        <div className="absolute inset-y-0 -translate-x-1/2 border-l border-white/80 shadow-[0_0_20px_rgba(255,255,255,0.4)]" />
        <div
          role="slider"
          tabIndex={0}
          aria-label="Wipe between the two terrains"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos * 100)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setPos((p) => Math.max(0.02, p - 0.05))
            if (e.key === 'ArrowRight') setPos((p) => Math.min(0.98, p + 0.05))
          }}
          className="pointer-events-auto absolute top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border border-white/70 bg-ink-950/80 text-slate-100 shadow-lg"
        >
          <MoveHorizontal className="size-4" />
        </div>
      </div>

      {[left, right].map((side, i) => (
        <div key={side.label} className={cn('pointer-events-none absolute top-3 max-w-[45%] rounded-md bg-ink-950/80 px-2.5 py-1.5', i === 0 ? 'left-3' : 'right-3 text-right')}>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: side.accent }}>
            {side.sub}
          </p>
          <p className="truncate text-xs font-medium text-slate-100">{side.label}</p>
        </div>
      ))}
      <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-ink-950/75 px-2 py-1 font-mono text-[10px] text-slate-300">
        both windows 20 × 20 km · 100 m cells
      </p>
    </motion.div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useSpring } from 'motion/react'
import { Layers, ListOrdered, Mountain, Radar, Scale } from 'lucide-react'
import type { AllTargets } from '@/hooks/useAllTargets'
import { asset } from '@/lib/asset'
import { fmtValue, pct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { BODY, ROLE } from '@/components/explorer/roles'

const STEPS = [
  {
    icon: Mountain,
    kicker: 'Step 1 · Target',
    title: 'Start from a real landing region.',
    body: 'Jezero Crater, where Perseverance landed, from a 20 m USGS elevation model. Mons Mouton Plateau, an Artemis III candidate near the lunar south pole, from NASA’s 20 m LOLA mosaic.',
    tone: 'var(--reference)',
  },
  {
    icon: Layers,
    kicker: 'Step 2 · Same grid',
    title: 'Cut every place to the same ruler.',
    body: 'Each window is 20 × 20 km, resampled to 100 m cells: 40,000 cells per site, on Earth, Mars and the Moon alike. Only the shape of the ground is kept, never absolute height.',
    tone: 'var(--data)',
  },
  {
    icon: Scale,
    kicker: 'Step 3 · Measure',
    title: 'Five numbers describe the terrain.',
    body: 'Typical slope, steep ground, relief, ruggedness and hypsometry, computed by the same code for every world. Each is compared on a robust scale, then averaged with weights you can change.',
    tone: 'var(--derived)',
  },
  {
    icon: ListOrdered,
    kicker: 'Step 4 · Validate',
    title: 'Check the method against NASA.',
    body: 'If the score means anything, Earth sites that NASA already pairs with the target should rank above farmland, rainforest and glaciers. The separation is measured as AUC and published, weak spots included.',
    tone: 'var(--positive)',
  },
  {
    icon: Radar,
    kicker: 'Step 5 · Discover',
    title: 'Screen ground nobody picked.',
    body: 'Hundreds of 20 km windows across deserts, volcanic fields and polar regions are scored the same way. The best become leads for expert and field review, clearly marked as unreviewed.',
    tone: 'var(--screen)',
  },
]

/* --------------------------------------------------------------------------------------- visuals */

function TargetsVisual({ data }: { data: AllTargets }) {
  return (
    <div className="grid h-full grid-cols-2 gap-3 p-4">
      {data.common.targets.targets.map((t, i) => (
        <motion.figure
          key={t.id}
          initial={{ opacity: 0, y: 20, rotate: i ? 2 : -2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ delay: i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-xl border border-white/10"
        >
          <img src={asset(t.quicklooks.hillshade)} alt={`${t.short} shaded relief`} className="h-full w-full object-cover" />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/95 to-transparent p-3 pt-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: BODY[t.body].color }}>
              {BODY[t.body].label}
            </p>
            <p className="text-sm font-medium text-slate-100">{t.short}</p>
          </figcaption>
        </motion.figure>
      ))}
    </div>
  )
}

function GridVisual({ data }: { data: AllTargets }) {
  const t = data.common.targets.targets[0]!
  return (
    <div className="relative h-full overflow-hidden">
      <motion.img
        src={asset(t.quicklooks.hillshade)}
        alt=""
        initial={{ scale: 1.25 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* 100 m grid drawn over the window, line by line */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 200" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: 21 }, (_, i) => (
          <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.035 }}>
            <line x1={i * 10} x2={i * 10} y1={0} y2={200} stroke="rgb(127 216 230 / 0.55)" strokeWidth={0.7} />
            <line y1={i * 10} y2={i * 10} x1={0} x2={200} stroke="rgb(127 216 230 / 0.55)" strokeWidth={0.7} />
          </motion.g>
        ))}
      </svg>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.1 }} className="absolute bottom-4 left-4 rounded-lg border border-white/10 bg-ink-950/85 px-3 py-2 backdrop-blur">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-data">20 × 20 km · lines every 1 km</p>
        <p className="text-sm text-slate-100">
          <span className="tabular text-xl">40,000</span> cells per site
        </p>
      </motion.div>
    </div>
  )
}

function MeasureVisual({ data }: { data: AllTargets }) {
  const t = data.common.targets.targets[0]!
  const b = data.byId[t.id]!
  const best = b.analysis.results[0]!
  const meta = b.indicators.profile.indicators
  return (
    <div className="flex h-full flex-col justify-center gap-4 p-6">
      <p className="font-mono text-[11px] text-slate-400">
        <span style={{ color: BODY[t.body].color }}>{t.short}</span> vs <span className="text-data">{best.site.name}</span>
      </p>
      {b.analysis.indicatorIds.map((id, i) => {
        const m = meta.find((x) => x.id === id)
        return (
          <div key={id}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-200">{m?.label}</span>
              <span className="tabular text-slate-400">
                {fmtValue(b.analysis.reference[i]!, m?.unit ?? '')} · {fmtValue(best.values[i]!, m?.unit ?? '')}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-derived to-data"
                initial={{ width: 0 }}
                animate={{ width: `${best.sims[i]! * 100}%` }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        )
      })}
      <p className="text-sm text-slate-300">
        Overall match <span className="tabular text-2xl text-slate-100">{pct(best.score)}</span>
        <span className="text-slate-500"> /100</span>
      </p>
    </div>
  )
}

function ValidateVisual({ data }: { data: AllTargets }) {
  const t = data.common.targets.targets[0]!
  const b = data.byId[t.id]!
  const rows = (['documented', 'candidate', 'control'] as const).map((role) => ({ role, items: b.analysis.results.filter((r) => r.site.role === role) }))
  const lo = Math.min(...b.analysis.results.map((r) => r.score)) - 0.03
  const x = (s: number) => `${((s - lo) / (1 - lo)) * 100}%`
  return (
    <div className="flex h-full flex-col justify-center gap-5 p-6">
      <div className="flex items-end justify-between">
        <p className="font-mono text-[11px] text-slate-400">Similarity to {t.short}, every curated site</p>
        <p className="text-right">
          <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">AUC</span>
          <span className="tabular text-3xl text-positive">{b.validation.retrieval.auc_documented.toFixed(2)}</span>
        </p>
      </div>
      {rows.map(({ role, items }, ri) => (
        <div key={role}>
          <p className="mb-1.5 text-xs" style={{ color: ROLE[role].color }}>
            {ROLE[role].short}
          </p>
          <div className="relative h-7 rounded-full bg-white/5">
            {items.map((r, i) => (
              <motion.span
                key={r.site.id}
                title={`${r.site.name} · ${pct(r.score)}`}
                initial={{ left: '0%', opacity: 0 }}
                animate={{ left: x(r.score), opacity: 1 }}
                transition={{ delay: 0.2 + ri * 0.15 + i * 0.04, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-ink-950"
                style={{ borderColor: ROLE[role].color, borderStyle: role === 'control' ? 'dashed' : 'solid' }}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-between font-mono text-[10px] text-slate-500">
        <span>less similar</span>
        <span>more similar →</span>
      </div>
    </div>
  )
}

function ScreenVisual({ data }: { data: AllTargets }) {
  const wins = data.common.screening?.windows ?? []
  const t = data.common.targets.targets[0]!
  const scored = data.byId[t.id]!.analysis.screened
  const max = Math.max(...scored.map((s) => s.score), 0.01)
  return (
    <div className="relative h-full overflow-hidden">
      <img src={asset('media/earth-1k.webp')} alt="" className="absolute inset-0 h-full w-full object-fill opacity-60" />
      <div className="absolute inset-0">
        {scored.map((s, i) => (
          <motion.span
            key={s.site.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.3 + 0.7 * (s.score / max) }}
            transition={{ delay: 0.1 + (i % 60) * 0.012, type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-screen"
            style={{ left: `${((s.site.lon + 180) / 360) * 100}%`, top: `${((90 - s.site.lat) / 180) * 100}%` }}
          />
        ))}
      </div>
      <div className="absolute bottom-4 left-4 rounded-lg border border-white/10 bg-ink-950/85 px-3 py-2 backdrop-blur">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-screen">Unreviewed leads</p>
        <p className="text-sm text-slate-100">
          <span className="tabular text-xl">{wins.length}</span> windows · {data.common.screening?.regions.length ?? 0} regions
        </p>
      </div>
    </div>
  )
}

const VISUALS = [TargetsVisual, GridVisual, MeasureVisual, ValidateVisual, ScreenVisual]

/* --------------------------------------------------------------------------------------- section */

function Step({ i, active, onActive }: { i: number; active: boolean; onActive: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  // active while the text itself crosses the middle band of the screen, level with the pinned visual
  const inView = useInView(ref, { margin: '-42% 0px -42% 0px' })
  useEffect(() => {
    if (inView) onActive(i)
  }, [inView, i, onActive])
  const s = STEPS[i]!
  return (
    <div className="flex min-h-[62svh] items-center py-10 lg:min-h-[78svh]">
      <motion.div ref={ref} animate={{ opacity: active ? 1 : 0.28, x: active ? 0 : -6 }} transition={{ duration: 0.4 }} className="max-w-md">
        <p className="label-mono flex items-center gap-2" style={{ color: s.tone }}>
          <s.icon className="size-4" /> {s.kicker}
        </p>
        <h3 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">{s.title}</h3>
        <p className="mt-3 text-pretty text-[15px] leading-relaxed text-slate-300">{s.body}</p>
      </motion.div>
    </div>
  )
}

/**
 * Scrollytelling: the visual stays pinned while the five pipeline steps scroll past.
 * On phones the visual pins to the top half and the text scrolls underneath.
 */
export function HowItWorks({ data }: { data: AllTargets }) {
  const reduced = useReducedMotion()
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 60%', 'end 60%'] })
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30 })
  const Visual = VISUALS[active]!

  return (
    <div ref={ref} className="relative grid gap-x-12 lg:grid-cols-[1fr_1.1fr]">
      {/* pinned visual */}
      <div className="sticky top-16 z-10 -mx-6 bg-background/90 px-6 pb-4 pt-3 backdrop-blur-md lg:order-2 lg:top-24 lg:mx-0 lg:h-[calc(100svh-8rem)] lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <div className="relative h-[34svh] overflow-hidden rounded-2xl border border-border bg-ink-900 lg:h-full lg:max-h-[620px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, scale: reduced ? 1 : 0.97, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: reduced ? 1 : 1.02, filter: 'blur(6px)' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              <Visual data={data} />
            </motion.div>
          </AnimatePresence>
        </div>
        {/* step dots + progress */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                className={cn('h-1.5 rounded-full transition-all duration-500', i === active ? 'w-6' : 'w-1.5 bg-white/20')}
                style={i === active ? { background: s.tone } : undefined}
              />
            ))}
          </div>
          <div className="h-px flex-1 overflow-hidden bg-white/10">
            <motion.div className="h-full origin-left bg-gradient-to-r from-reference via-derived to-screen" style={{ scaleX: progress }} />
          </div>
          <span className="font-mono text-[11px] tabular text-slate-400">0{active + 1}/05</span>
        </div>
      </div>

      {/* scrolling steps */}
      <div className="lg:order-1">
        {STEPS.map((s, i) => (
          <Step key={s.title} i={i} active={i === active} onActive={setActive} />
        ))}
      </div>
    </div>
  )
}

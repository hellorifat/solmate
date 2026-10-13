import { useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import type { IndicatorsDoc, TargetSummary } from '@/data/schema'
import { fmtValue } from '@/lib/format'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { BODY } from '@/components/explorer/roles'
import { PLAIN } from './indicatorGlyphs'

type Meta = IndicatorsDoc['profile']['indicators']

function Card({ m, i, targets }: { m: Meta[number]; i: number; targets: TargetSummary[] }) {
  const reduced = useReducedMotion()
  const p = PLAIN[m.id]
  const vals = targets.map((t) => t.indicators[m.id] ?? 0)
  const max = Math.max(...vals, 1e-9)
  return (
    <article className="flex h-[440px] w-[78vw] max-w-[360px] shrink-0 snap-center flex-col rounded-2xl border border-border bg-card p-6 lg:w-[360px]">
      <div className="flex items-start justify-between">
        <span className="font-mono text-5xl font-medium text-white/10">0{i + 1}</span>
        <span className="label-mono">{m.unit || 'ratio'}</span>
      </div>
      <svg viewBox="0 0 76 36" className="mt-6 h-16 w-full" aria-hidden="true">
        <motion.path
          d={p?.path ?? 'M2 30 L74 30'}
          fill="none"
          stroke="var(--data)"
          strokeWidth={1.4}
          strokeLinejoin="round"
          initial={{ pathLength: reduced ? 1 : 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        />
      </svg>
      <h3 className="mt-6 text-xl font-semibold leading-snug tracking-tight">{m.label}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p?.hint ?? m.description}</p>
      <dl className="mt-auto space-y-3 border-t border-border pt-4">
        {targets.map((t, k) => (
          <div key={t.id}>
            <div className="flex items-baseline justify-between text-xs">
              <dt style={{ color: BODY[t.body].color }}>{t.short}</dt>
              <dd className="tabular text-base text-slate-100">{fmtValue(vals[k]!, m.unit)}</dd>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full"
                style={{ background: BODY[t.body].color }}
                initial={{ width: 0 }}
                whileInView={{ width: `${(vals[k]! / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: 0.2 + k * 0.1 }}
              />
            </div>
          </div>
        ))}
      </dl>
    </article>
  )
}

function Intro() {
  return (
    <div className="flex w-[78vw] max-w-[420px] shrink-0 snap-start flex-col justify-center lg:w-[420px]">
      <p className="label-mono">What gets measured</p>
      <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl">Five terrain numbers, computed the same way on every world.</h2>
      <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
        Absolute elevation is never compared, only the shape of the ground. Bars compare the two targets.
      </p>
      <p className="mt-6 hidden font-mono text-[11px] text-slate-500 lg:block">Keep scrolling →</p>
    </div>
  )
}

/**
 * Horizontal scroll section. On large screens it pins and turns vertical scrolling into a sideways track;
 * on phones it is a native swipe carousel with snap points.
 */
export function IndicatorTrack({ meta, targets }: { meta: Meta; targets: TargetSummary[] }) {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const reduced = useReducedMotion()
  const outer = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [dist, setDist] = useState(0)
  const { scrollYProgress } = useScroll({ target: outer, offset: ['start start', 'end end'] })
  const x = useTransform(scrollYProgress, [0, 1], [0, -dist])
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1])

  useLayoutEffect(() => {
    const el = track.current
    if (!el || !desktop) return
    const measure = () => setDist(Math.max(0, el.scrollWidth - window.innerWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [desktop])

  const items = (
    <>
      <Intro />
      {meta.map((m, i) => (
        <Card key={m.id} m={m} i={i} targets={targets} />
      ))}
      <div className="w-6 shrink-0 lg:w-[10vw]" aria-hidden="true" />
    </>
  )

  if (!desktop || reduced) {
    return (
      <section className="py-20" aria-label="Terrain indicators">
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 [scrollbar-width:none] md:px-10">{items}</div>
      </section>
    )
  }

  return (
    <section ref={outer} className="relative" style={{ height: `calc(100svh + ${dist}px)` }} aria-label="Terrain indicators">
      <div className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden">
        <motion.div ref={track} style={{ x }} className="flex w-max items-center gap-6 pl-[max(2.5rem,calc((100vw-72rem)/2+2.5rem))]">
          {items}
        </motion.div>
        <div className="mx-auto mt-10 h-px w-full max-w-6xl overflow-hidden bg-white/10 px-10">
          <motion.div className="h-full origin-left bg-data" style={{ scaleX: bar }} />
        </div>
      </div>
    </section>
  )
}

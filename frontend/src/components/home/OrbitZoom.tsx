import { useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import type { AllTargets } from '@/hooks/useAllTargets'
import { asset } from '@/lib/asset'
import { fmtValue, pct } from '@/lib/format'
import { useMediaQuery } from '@/hooks/useMediaQuery'

/**
 * Pinned zoom story: Mars from orbit → zoom into a 20 km window at Jezero Crater → its best Earth match
 * slides in beside it → the five indicator bars and the score. Vertical scroll drives every step.
 */
export function OrbitZoom({ data }: { data: AllTargets }) {
  const reduced = useReducedMotion() ?? false
  const narrow = !useMediaQuery('(min-width: 1024px)')
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [phase, setPhase] = useState(0)
  useMotionValueEvent(p, 'change', (v) => setPhase(v < 0.3 ? 0 : v < 0.52 ? 1 : v < 0.74 ? 2 : 3))

  const t = data.common.targets.targets.find((x) => x.body === 'mars') ?? data.common.targets.targets[0]!
  const b = data.byId[t.id]!
  const best = b.analysis.results.find((r) => r.site.quicklooks?.imagery) ?? b.analysis.results[0]!
  const meta = b.indicators.profile.indicators

  // stage transforms
  const g0 = narrow ? 0.92 : 0.62
  const globeScale = useTransform(p, [0.08, 0.42], [g0, reduced ? g0 : 7])
  const globeOpacity = useTransform(p, [0.3, 0.42], [1, 0])
  const winOpacity = useTransform(p, [0.3, 0.42], [0, 1])
  const split = narrow ? 0.74 : 1 // side by side must fit a phone's width
  const winScale = useTransform(p, [0.3, 0.44, 0.52, 0.66], [1.8, 1, 1, split])
  const winX = useTransform(p, [0.52, 0.66], ['0%', narrow ? '-40%' : '-54%'])
  const matchX = useTransform(p, [0.52, 0.66], ['120%', narrow ? '40%' : '54%'])
  const matchScale = useTransform(p, [0.52, 0.66], [1, split])
  const matchOpacity = useTransform(p, [0.52, 0.62], [0, 1])
  const frame = useTransform(p, [0.36, 0.5], [0, 1])
  const scoreOpacity = useTransform(p, [0.72, 0.8], [0, 1])
  const scoreY = useTransform(p, [0.72, 0.8], [30, 0])
  const progress = useTransform(p, [0, 1], [0, 1])

  const captions = [
    { k: 'Mars, from orbit', h: 'Start with a real landing site.', s: 'Jezero Crater, where Perseverance landed in 2021, sits on the rim of the Isidis basin.' },
    { k: 'Zoom to the ground', h: 'Cut a 20 × 20 km window.', s: 'Every place, on any world, is cut to the same size and resampled to 100 m cells.' },
    { k: 'Search Earth', h: `Its closest twin: ${best.site.name.split(',')[0]}.`, s: `${best.site.country ?? 'Earth'}. Chosen only by the shape of the ground, from Copernicus elevation data.` },
    { k: 'Score', h: `${pct(best.score)}/100 terrain match.`, s: 'Five indicators compared on a robust scale. Every number is open to inspection.' },
  ]
  const c = captions[phase]!

  return (
    <section ref={ref} className="relative h-[420svh]" aria-label="From orbit to an Earth twin">
      <div className="sticky top-0 flex h-svh flex-col overflow-hidden lg:flex-row lg:items-center">
        {/* caption */}
        <div className="relative z-10 order-2 mx-auto w-full max-w-6xl px-6 pb-8 lg:order-1 lg:w-[38%] lg:max-w-none lg:pb-0 lg:pl-[max(2.5rem,calc((100vw-72rem)/2+2.5rem))] lg:pr-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, filter: 'blur(6px)' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="label-mono text-mars">
                0{phase + 1} · {c.k}
              </p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">{c.h}</h2>
              <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">{c.s}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-6 h-px w-48 overflow-hidden bg-white/10">
            <motion.div className="h-full origin-left bg-gradient-to-r from-mars to-data" style={{ scaleX: progress }} />
          </div>
        </div>

        {/* stage */}
        <div className="relative order-1 flex flex-1 items-center justify-center pt-20 lg:order-2 lg:h-full lg:pt-0">
          <div className="relative aspect-square w-[min(78vw,46svh)] lg:w-[min(40vw,62svh)]">
            <motion.img
              src={asset('media/globe-mars.webp')}
              alt="Mars, centred on Jezero Crater"
              style={{ scale: globeScale, opacity: globeOpacity }}
              className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_0_60px_rgb(217_120_90/0.25)]"
              draggable={false}
            />
            {/* Jezero window */}
            <motion.figure style={{ opacity: winOpacity, scale: winScale, x: winX }} className="absolute inset-[18%] overflow-hidden rounded-lg">
              <img src={asset(t.quicklooks.imagery ?? t.quicklooks.hillshade)} alt="Jezero Crater, 20 km window" className="h-full w-full object-cover" />
              <motion.div style={{ opacity: frame }} className="pointer-events-none absolute inset-0 rounded-lg border-2 border-dashed border-reference" />
              <figcaption className="absolute left-2 top-2 rounded bg-ink-950/80 px-2 py-1 font-mono text-[10px] text-reference">MARS · {t.short}</figcaption>
            </motion.figure>
            {/* Earth match */}
            <motion.figure style={{ opacity: matchOpacity, x: matchX, scale: matchScale }} className="absolute inset-[18%] overflow-hidden rounded-lg border-2 border-data/70">
              <img src={asset(best.site.quicklooks?.imagery ?? best.site.quicklooks?.hillshade ?? '')} alt={`${best.site.name}, 20 km window`} className="h-full w-full object-cover" />
              <figcaption className="absolute left-2 top-2 rounded bg-ink-950/80 px-2 py-1 font-mono text-[10px] text-data">EARTH · {best.site.name.split(',')[0]}</figcaption>
            </motion.figure>
            {/* score + bars */}
            <motion.div style={{ opacity: scoreOpacity, y: scoreY }} className="absolute inset-x-[4%] -bottom-[6%] rounded-xl border border-white/10 bg-ink-950/85 p-3 backdrop-blur-md lg:-bottom-[14%]">
              <div className="flex items-center justify-between">
                <span className="label-mono">Terrain match</span>
                <span className="tabular text-2xl text-slate-100">
                  {pct(best.score)}
                  <span className="text-sm text-slate-500">/100</span>
                </span>
              </div>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {b.analysis.indicatorIds.map((id, i) => {
                  const m = meta.find((x) => x.id === id)
                  return (
                    <div key={id} title={`${m?.label}: ${fmtValue(b.analysis.reference[i]!, m?.unit ?? '')} vs ${fmtValue(best.values[i]!, m?.unit ?? '')}`}>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-derived to-data" style={{ width: `${best.sims[i]! * 100}%` }} />
                      </div>
                      <p className="mt-1 truncate text-[10px] text-slate-400">{m?.label.split(' (')[0]}</p>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

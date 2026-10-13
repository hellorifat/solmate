import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { fadeUp, stagger } from '@/design/motion'
import { useAllTargets, type AllTargets } from '@/hooks/useAllTargets'
import { TargetSwitcher } from '@/components/explorer/TargetSwitcher'
import { CountUp } from '@/components/home/CountUp'
import { TargetShowcase } from '@/components/home/TargetShowcase'
import { WorldMap } from '@/components/home/WorldMap'
import { LiveResults } from '@/components/home/LiveResults'
import { IndicatorTrack } from '@/components/home/IndicatorTrack'
import { HowItWorks } from '@/components/home/HowItWorks'
import { ParallaxWorlds, ScrollRevealText, StackCards, TiltCard, ZoomOnScroll } from '@/components/home/ScrollFx'
import { OrbitZoom } from '@/components/home/OrbitZoom'
import { Hero } from '@/components/hero/Hero'

const LESSONS = [
  {
    title: 'Apollo lunar dust',
    body: 'Sharp, unweathered regolith grains abraded spacesuit fabric and fouled seals during Apollo surface operations.',
  },
  {
    title: 'InSight heat probe',
    body: 'The HP3 “mole” could not penetrate the cemented Martian surface layer at the InSight landing site (2019–2021).',
  },
  {
    title: 'A few famous sites',
    body: 'Death Valley, the Atacama and Haughton Crater are valuable, but they cannot represent every target, mission or instrument.',
  },
]

function Stats({ data }: { data: AllTargets }) {
  const reduced = useReducedMotion()
  const first = Object.values(data.byId)[0]
  const curated = first?.analysis.results.length ?? 0
  const screened = data.common.screening?.windows.length ?? 0
  const regions = data.common.screening?.regions.length ?? 0
  const aucs = data.common.targets.targets.map((t) => t.auc_documented)
  const items = [
    { value: data.common.targets.targets.length, label: 'planetary targets', sub: 'Mars + lunar south pole' },
    { value: curated, label: 'curated Earth sites', sub: 'analogs, candidates, controls' },
    ...(screened ? [{ value: screened, label: 'screened windows', sub: `${regions} regions, unreviewed` }] : []),
    { value: Math.min(...aucs), decimals: 2, label: 'validation AUC', sub: `${new Set(aucs.map((a) => a.toFixed(2))).size === 1 ? 'both targets' : 'lowest target'} · 0.5 = chance` },
  ]
  return (
    <motion.section
      id="numbers"
      variants={stagger(0.08)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-10% 0px' }}
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 pt-10 md:px-10"
    >
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
        {items.map((s) => (
          <motion.div key={s.label} variants={fadeUp(reduced)} className="bg-card">
            <TiltCard className="h-full p-5 md:p-6">
              <p className="text-3xl font-semibold text-slate-100 md:text-4xl">
                <CountUp value={s.value} decimals={s.decimals ?? 0} />
              </p>
              <p className="mt-2 text-sm text-slate-200">{s.label}</p>
              <p className="mt-0.5 text-xs text-slate-400">{s.sub}</p>
            </TiltCard>
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}

function Section({ kicker, title, intro, children, id, aside, className }: { kicker: string; title: string; intro?: string; children: ReactNode; id?: string; aside?: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <motion.section
      id={id}
      variants={stagger(0.08)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-12% 0px' }}
      className={`relative mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20 md:px-10 md:py-24 ${className ?? ''}`}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <motion.p variants={fadeUp(reduced)} className="label-mono">
            {kicker}
          </motion.p>
          <motion.h2 variants={fadeUp(reduced)} className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            {title}
          </motion.h2>
          {intro && (
            <motion.p variants={fadeUp(reduced)} className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
              {intro}
            </motion.p>
          )}
        </div>
        {aside && (
          <motion.div variants={fadeUp(reduced)} className="w-full md:w-80 md:shrink-0">
            {aside}
          </motion.div>
        )}
      </div>
      <div className="mt-10 md:mt-12">{children}</div>
    </motion.section>
  )
}

function Results({ data, between }: { data: AllTargets; between?: ReactNode }) {
  const targets = data.common.targets.targets
  const [targetId, setTargetId] = useState(targets[0]!.id)
  const target = targets.find((t) => t.id === targetId) ?? targets[0]!
  const bundle = data.byId[target.id]!
  const switcher = (where: string) => <TargetSwitcher targets={targets} value={target.id} onChange={setTargetId} pillId={`home-target-${where}`} />

  return (
    <>
      <Section
        id="compare"
        kicker="See the match"
        title="Drag across two worlds at the same scale."
        intro="Each panel is a 20 × 20 km window resampled to 100 m cells. Pick a target, then compare it with its closest Earth sites."
        aside={switcher('compare')}
      >
        <ZoomOnScroll>
          <AnimatePresence mode="wait">
            <motion.div key={target.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
              <TargetShowcase target={target} bundle={bundle} />
            </motion.div>
          </AnimatePresence>
        </ZoomOnScroll>
      </Section>

      {between}

      <Section
        id="map"
        kicker="Where the analogs are"
        title={`Every scored place on Earth, for ${target.short}.`}
        intro={
          data.common.screening
            ? 'Rings are curated sites, sized by similarity; the top three pulse. Pink dots are screened windows from 14 regions, brighter means more similar. Tap any point to open it.'
            : 'Rings are curated sites, sized by similarity; the top three pulse. Tap any point to open it.'
        }
        aside={switcher('map')}
      >
        <ZoomOnScroll>
          <WorldMap targetId={target.id} results={bundle.analysis.results} screened={bundle.analysis.screened} />
        </ZoomOnScroll>
      </Section>

      <Section id="results" kicker="Current ranking" title="Computed from real elevation data, not typed in." aside={switcher('results')}>
        <LiveResults target={target} bundle={bundle} />
      </Section>
    </>
  )
}

export default function HomePage() {
  const reduced = useReducedMotion()
  const state = useAllTargets()
  const data = state.status === 'ready' ? state.data : null
  const meta = data ? Object.values(data.byId)[0]?.indicators.profile.indicators : undefined

  return (
    <>
      <Hero data={data} />

      {state.status === 'loading' && (
        <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-16 md:px-10">
          <Skeleton className="h-28 w-full bg-ink-800" />
          <Skeleton className="h-96 w-full bg-ink-800" />
        </div>
      )}
      {state.status === 'error' && <p className="mx-auto max-w-6xl px-6 py-16 font-mono text-sm text-slate-400 md:px-10">Results are unavailable right now. The method and data pages still work.</p>}

      {data && (
        <>
          <Stats data={data} />
          <OrbitZoom data={data} />
          <Results
            data={data}
            between={
              <Section id="how" kicker="How it works" title="Five steps from a landing site to its Earth twins.">
                <HowItWorks data={data} />
                <div className="mx-auto mt-24 max-w-4xl text-center">
                  <ShieldCheck className="mx-auto size-6 text-positive" />
                  <ScrollRevealText
                    className="mt-6 justify-center text-balance text-2xl font-semibold leading-snug tracking-tight text-slate-100 md:text-4xl"
                    text="A similarity score is not proof that two places are the same. Every result keeps its mismatches, its data source and its uncertainty in plain view."
                  />
                  <Button asChild variant="data" size="sm" className="mt-8">
                    <Link to="/method">Read the limitations</Link>
                  </Button>
                </div>
              </Section>
            }
          />
          {meta && <IndicatorTrack meta={meta} targets={data.common.targets.targets} />}
        </>
      )}

      <Section kicker="Why analogs matter" title="Testing on Earth is cheaper than learning on another world." className="isolate">
        <ParallaxWorlds />
        <StackCards
          items={LESSONS.map((l, i) => (
            <article key={l.title} className="mx-auto grid max-w-4xl gap-6 rounded-2xl border border-border bg-card p-8 shadow-2xl md:grid-cols-[auto_1fr] md:p-10">
              <span className="font-mono text-5xl text-white/10">0{i + 1}</span>
              <div>
                <TriangleAlert className="size-5 text-reference" />
                <h3 className="mt-4 text-2xl font-semibold tracking-tight">{l.title}</h3>
                <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">{l.body}</p>
              </div>
            </article>
          ))}
        />
      </Section>

      <Section kicker="Mission briefing" title="Why NASA rehearses on Earth.">
        <motion.div variants={fadeUp(reduced)} className="overflow-hidden rounded-xl border border-border bg-black">
          <iframe
            className="aspect-video w-full"
            src="https://www.youtube-nocookie.com/embed/N0f-QkEVU7U"
            title="6 NASA Technologies to Get Humans to Mars"
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </motion.div>
        <p className="mt-3 font-mono text-xs text-slate-400">Video: NASA, “6 NASA Technologies to Get Humans to Mars”.</p>
      </Section>
    </>
  )
}

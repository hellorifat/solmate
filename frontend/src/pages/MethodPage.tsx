import { useEffect, useMemo, useState } from 'react'
import { TargetSwitcher } from '@/components/explorer/TargetSwitcher'
import { Link, useLocation } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState, PanelSkeleton } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { useAnalysisData } from '@/hooks/useAnalysisData'
import { analyse, equalWeights } from '@/science/analysis'
import { fmtValue, ordinal } from '@/lib/format'
import { fadeUp } from '@/design/motion'
import { ROLE } from '@/components/explorer/roles'
import type { AnalysisData } from '@/data/load'

export default function MethodPage() {
  const [target, setTarget] = useState('jezero')
  const state = useAnalysisData(target)
  return (
    <>
      <PageHeader
        kicker="Method"
        title="How SolMate compares terrain."
        lead="Two planetary targets, Earth elevation data on the same grid, five terrain indicators and a weighted score you can inspect. Then a test of whether the method finds sites NASA already uses."
      />
      {state.status === 'loading' && (
        <div className="mx-auto w-full max-w-4xl px-6">
          <PanelSkeleton />
        </div>
      )}
      {state.status === 'error' && <ErrorState title="Results could not be loaded." detail={state.error.message} onRetry={state.retry} />}
      {state.status === 'ready' && (
        <>
          <div className="sticky top-16 z-20 border-y border-border bg-background/95 py-3">
            <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-6">
              <span className="label-mono">Results shown for</span>
              <div className="w-full max-w-sm">
                <TargetSwitcher targets={state.data.targets.targets} value={state.data.indicators.reference.id} onChange={setTarget} />
              </div>
            </div>
          </div>
          <MethodBody data={state.data} />
        </>
      )}
    </>
  )
}

function Block({ id, kicker, title, children }: { id?: string; kicker: string; title: string; children: React.ReactNode }) {
  const reduced = useReducedMotion()
  return (
    <motion.section
      id={id}
      variants={fadeUp(reduced)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-10% 0px' }}
      className="scroll-mt-24 border-t border-border py-14"
    >
      <p className="label-mono">{kicker}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-slate-300">{children}</div>
    </motion.section>
  )
}

function Stat({ label, value, note, tone = 'text-slate-100' }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="label-mono">{label}</p>
      <p className={`mt-2 font-mono text-3xl tabular ${tone}`}>{value}</p>
      {note && <p className="mt-1.5 text-xs text-slate-400">{note}</p>}
    </div>
  )
}

function MethodBody({ data }: { data: AnalysisData }) {
  const { indicators: doc, validation: v } = data
  const { hash } = useLocation()
  useEffect(() => {
    // content renders after data loads, so honour #anchors once it exists
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])
  const res = useMemo(() => analyse(doc, equalWeights(doc.profile.scored)), [doc])
  const meta = doc.profile.indicators
  const r = v.retrieval
  const p = v.weight_perturbation.auc_documented
  const groups = (['documented', 'candidate', 'control'] as const).map((role) => ({ role, items: res.results.filter((x) => x.site.role === role) }))
  const corr = v.correlation

  return (
    <div className="mx-auto w-full max-w-4xl px-6 pb-24">
      <Block kicker="01 · Scope" title="A terrain profile, not a claim of sameness.">
        <p>
          The reference is the <strong className="text-slate-100">{doc.reference.name}</strong> on the {doc.reference.pair}. {doc.reference.note} The comparison asks one narrow question: which Earth sites have ground that is shaped like this at rover-traverse scale? That is useful for
          mobility, navigation and field-geology rehearsal. It says nothing about chemistry, climate, radiation or gravity.
        </p>
        <p>
          Mineralogy and other documented properties appear in the explorer as cited context and are <strong className="text-slate-100">never scored</strong>.
        </p>
      </Block>

      <Block kicker="02 · Data and scale" title="Same physical grid on both worlds.">
        <ul className="list-disc space-y-2 pl-5 marker:text-slate-500">
          <li>
            <strong className="text-slate-100">Mars:</strong> USGS Mars 2020 Terrain Relative Navigation CTX digital terrain model of Jezero, 20 m per pixel.
          </li>
          <li>
            <strong className="text-slate-100">Moon:</strong> LOLA south-pole elevation mosaic from NASA Goddard (PGDA), 20 m per pixel, polar stereographic.
          </li>
          <li>
            <strong className="text-slate-100">Earth:</strong> Copernicus DEM GLO-30 (about 30 m), read directly from the AWS Open Data registry.
          </li>
          <li>
            Both are averaged down to <strong className="text-slate-100">100 m cells</strong> in a <strong className="text-slate-100">20 × 20 km window</strong> centred on each
            site. Downsampling only: no detail finer than the source is invented. Absolute elevation is never compared.
          </li>
        </ul>
        <Link to="/provenance" className="inline-flex items-center gap-1.5 font-mono text-xs text-data hover:underline">
          Full provenance and licences <ArrowRight className="size-3" />
        </Link>
      </Block>

      <Block kicker="03 · Indicators" title="Five terrain indicators, computed with the same code.">
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-850">
              <tr>
                <th className="px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-wider text-slate-400">Indicator</th>
                <th className="px-4 py-3 text-right font-mono text-[11px] font-normal uppercase tracking-wider text-reference">Jezero</th>
                <th className="hidden px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-wider text-slate-400 md:table-cell">What it measures</th>
              </tr>
            </thead>
            <tbody>
              {meta.map((m) => (
                <tr key={m.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 text-slate-100">{m.label}</td>
                  <td className="px-4 py-3 text-right font-mono tabular text-slate-200">{fmtValue(doc.reference.indicators[m.id]!, m.unit)}</td>
                  <td className="hidden px-4 py-3 text-slate-400 md:table-cell">{m.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Block kicker="04 · Similarity" title="A score you can take apart.">
        <ol className="list-decimal space-y-2 pl-5 marker:font-mono marker:text-slate-500">
          <li>For each indicator, find the median and the spread (1.4826 × median absolute deviation) across all Earth sites.</li>
          <li>Measure how far a site is from Jezero in those robust units, then convert that gap to a similarity between 0 and 1.</li>
          <li>Average the five similarities with your weights. Equal weights by default.</li>
        </ol>
        <div className="rounded-xl border border-border bg-ink-850 p-5 font-mono text-sm text-slate-200">
          <p>
            s<sub>i</sub> = exp( −½ · ((x<sub>i</sub> − x<sub>i,Jezero</sub>) / σ<sub>i</sub>)² )
          </p>
          <p className="mt-2">S = Σ w<sub>i</sub> s<sub>i</sub> / Σ w<sub>i</sub></p>
        </div>
        <p>
          The browser and the Python pipeline implement the same formula. Automated tests check that they agree to nine decimal places for every
          site.
        </p>
      </Block>

      <Block id="validation" kicker="05 · Validation" title="Does it find the sites NASA already uses?">
        <p>
          If terrain similarity is meaningful, Earth sites that NASA pairs with the {r.pair} in its{' '}
          <a className="text-data hover:underline" href="https://science.nasa.gov/solar-system/analog-explorer/" target="_blank" rel="noreferrer">
            Planetary Analog Explorer
          </a>{' '}
          should score above farmland, rainforest and alpine glaciers. They do, at equal weights:
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Retrieval AUC" value={r.auc_documented.toFixed(2)} note={`${r.n_positive} ${r.pair}-paired sites vs ${r.n_negative} controls. 0.5 = chance, 1 = perfect.`} tone="text-positive" />
          <Stat label="Under random weights" value={`${p.p5.toFixed(2)}–${p.p95.toFixed(2)}`} note={`5th–95th percentile over ${v.weight_perturbation.n.toLocaleString()} Dirichlet weightings`} />
          <Stat label="Top five" value={`${r.documented_in_top5}/5`} note={`are NASA-documented analog sites; ${r.controls_in_top5 === 0 ? 'no control' : `${r.controls_in_top5} control`} in the top five`} />
        </div>

        <ScoreStrip groups={groups} />

        <p className="font-medium text-slate-100">Where it is weak</p>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-850">
              <tr>
                <th className="px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-wider text-slate-400">Analysis setting</th>
                <th className="px-4 py-3 text-right font-mono text-[11px] font-normal uppercase tracking-wider text-slate-400">Retrieval AUC</th>
                <th className="px-4 py-3 text-right font-mono text-[11px] font-normal uppercase tracking-wider text-slate-400">Rank agreement</th>
              </tr>
            </thead>
            <tbody>
              {v.sensitivity.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3 text-slate-200">
                    {c.label}
                    {c.id === 'primary' && <span className="ml-2 font-mono text-[11px] text-slate-400">(primary)</span>}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono tabular ${c.auc_documented < 0.7 ? 'text-negative' : 'text-slate-100'}`}>{c.auc_documented.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular text-slate-100">ρ = {c.spearman_vs_primary.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-2 pl-5 marker:text-slate-500">
          <li>
            <strong className="text-slate-100">Scale matters.</strong> In a 12 km window the retrieval AUC is{' '}
            {v.sensitivity.find((c) => c.id === 'smaller-window')?.auc_documented.toFixed(2)} (rank agreement ρ ={' '}
            {v.sensitivity.find((c) => c.id === 'smaller-window')?.spearman_vs_primary.toFixed(2)}). Results describe a 20 km traverse-scale landscape, not a
            landing-site patch.
          </li>
          <li>
            <strong className="text-slate-100">Forest canopy looks like rough ground.</strong> GLO-30 is a surface model, so the Amazon control ranks{' '}
            {ordinal(res.byId.get('amazon-forest')?.rank ?? 0)}: tree crowns add apparent roughness.
          </li>
          {doc.reference.body === 'mars' ? (
            <li>
              <strong className="text-slate-100">Lake Salda ranks {ordinal(res.byId.get('lake-salda')?.rank ?? 0)}.</strong> NASA pairs it with Jezero for its lake-edge
              sediments, not its landforms. A terrain-only profile cannot see mineralogy, which is why mineralogy stays a separate, unscored layer.
            </li>
          ) : (
            <li>
              <strong className="text-slate-100">Light and cold are not scored.</strong> The south pole&apos;s defining conditions (long shadows, permanently shadowed
              regions, extreme cold) have no Earth equivalent and are shown only as context. NASA&apos;s Moon-paired sites are chosen for basaltic geology, so they
              are a loose test for a polar massif.
            </li>
          )}
        </ul>
      </Block>

      <Block kicker="06 · Redundancy" title="Three indicators move together.">
        <p>
          Across the Earth sites, median slope, local relief and ruggedness are almost perfectly correlated, so equal weights count terrain
          roughness about three times. The explorer offers a <em>balanced</em> preset that gives this group the same total weight as each
          independent indicator.
        </p>
        <CorrelationGrid order={corr.order} matrix={corr.matrix} labels={Object.fromEntries(meta.map((m) => [m.id, m.label]))} />
      </Block>

      <Block kicker="07 · Limitations" title="What this prototype cannot tell you.">
        <ul className="list-disc space-y-2 pl-5 marker:text-slate-500">
          <li>Gravity, atmosphere, radiation, dust and surface chemistry differ between Earth and Mars and are not represented.</li>
          <li>Earth and Mars landscapes form under different erosion regimes; similar shape does not imply similar origin.</li>
          <li>The candidate list is curated (19 sites), not a global search. New analog discovery needs a tiled global scan.</li>
          <li>Validation labels come from one NASA outreach catalogue and cover purposes other than terrain; they are a sanity check, not ground truth.</li>
          <li>No field measurements were made. Any test recommendation would need expert review and on-site data.</li>
        </ul>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild>
            <Link to="/explorer">
              Explore the ranking <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/provenance">See every data source</Link>
          </Button>
        </div>
      </Block>
    </div>
  )
}

function ScoreStrip({ groups }: { groups: { role: 'documented' | 'candidate' | 'control'; items: ReturnType<typeof analyse>['results'] }[] }) {
  return (
    <figure className="rounded-xl border border-border bg-card p-5">
      <figcaption className="label-mono mb-4">Equal-weight similarity by site group</figcaption>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.role} className="grid grid-cols-[7rem_1fr] items-center gap-4">
            <span className="text-xs text-slate-300">{ROLE[g.role].short}</span>
            <div className="relative h-8 rounded-md bg-ink-850">
              {[0.25, 0.5, 0.75].map((t) => (
                <span key={t} className="absolute inset-y-0 w-px bg-ink-600" style={{ left: `${t * 100}%` }} aria-hidden="true" />
              ))}
              {g.items.map((it) => (
                <span
                  key={it.site.id}
                  title={`${it.site.name}: ${Math.round(it.score * 100)}`}
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                  style={{
                    left: `${it.score * 100}%`,
                    borderColor: ROLE[g.role].color,
                    borderStyle: g.role === 'control' ? 'dashed' : 'solid',
                    background: 'var(--ink-900)',
                  }}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-[7rem_1fr] gap-4 font-mono text-[10px] text-slate-400">
          <span />
          <div className="flex justify-between">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </figure>
  )
}

function CorrelationGrid({ order, matrix, labels }: { order: string[]; matrix: number[][]; labels: Record<string, string> }) {
  return (
    <figure className="overflow-x-auto rounded-xl border border-border bg-card p-5">
      <figcaption className="label-mono mb-4">Pearson correlation across Earth sites</figcaption>
      <table className="text-xs">
        <tbody>
          {order.map((row, i) => (
            <tr key={row}>
              <th className="whitespace-nowrap pr-3 text-left font-normal text-slate-300">{labels[row]}</th>
              {order.map((col, j) => {
                const c = matrix[i]![j]!
                return (
                  <td key={col} className="p-0.5">
                    <span
                      className="grid size-12 place-items-center rounded font-mono tabular"
                      style={{ background: `color-mix(in oklab, var(--data) ${Math.round(Math.abs(c) * 55)}%, var(--ink-850))`, color: Math.abs(c) > 0.6 ? 'var(--ink-950)' : 'var(--slate-300)' }}
                      title={`${labels[row]} × ${labels[col]}: ${c.toFixed(2)}`}
                    >
                      {c.toFixed(2)}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

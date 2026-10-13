import { useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
import type { IndicatorMeta, Reference, ValidationDoc } from '@/data/schema'
import type { SiteResult } from '@/science/analysis'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { asset } from '@/lib/asset'
import { fmtCoord, pct } from '@/lib/format'
import { BODY, ROLE } from './roles'
import { ScoreBreakdown } from './ScoreBreakdown'

type View = 'imagery' | 'hillshade' | 'slope'

interface Props {
  result: SiteResult
  reference: Reference
  referenceValues: number[]
  indicators: IndicatorMeta[]
  weights: Record<string, number>
  rankRange?: ValidationDoc['weight_perturbation']['rank_range'][string]
  sensitivityRanks: { label: string; rank: number }[]
  total: number
  onClose: () => void
  evidence?: React.ReactNode
}

function Thumb({ src, label, accent }: { src?: string; label: string; accent: string }) {
  return (
    <figure className="relative overflow-hidden rounded-lg border border-border bg-ink-950">
      {src ? (
        <img src={asset(src)} alt={label} className="aspect-square w-full object-cover" decoding="async" />
      ) : (
        <div className="grid aspect-square w-full place-items-center font-mono text-[11px] text-slate-400">No imagery</div>
      )}
      <figcaption className="absolute left-2 top-2 rounded bg-ink-950/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
        {label}
      </figcaption>
    </figure>
  )
}

export function SiteDetail({ result, reference, referenceValues, indicators, weights, rankRange, sensitivityRanks, total, onClose, evidence }: Props) {
  const [view, setView] = useState<View>('imagery')
  const { site } = result
  const role = ROLE[site.role]
  const mismatches = indicators.filter((_, j) => result.sims[j]! < 0.5)

  return (
    <article className="flex h-full flex-col" aria-labelledby="site-title">
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 pb-4 pt-5">
        <div className="min-w-0">
          <p className="label-mono" style={{ color: role.color }}>
            {role.label}
            {site.pair ? ` · paired with ${site.pair}` : ''}
          </p>
          <h2 id="site-title" className="mt-1.5 truncate text-xl font-semibold tracking-tight">
            {site.name}
          </h2>
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            {site.country ? `${site.country} · ` : ''}
            {fmtCoord(site.lat, site.lon)}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-ink-700 hover:text-slate-100" aria-label="Close site details">
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-[auto_1fr] items-end gap-5">
          <div>
            <p className="label-mono">Terrain similarity</p>
            <p className="mt-1 font-mono text-5xl font-medium tabular tracking-tight text-slate-100">
              {pct(result.score)}
              <span className="text-lg text-slate-400">/100</span>
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 pb-1.5 font-mono text-[11px]">
            <dt className="text-slate-400">Rank</dt>
            <dd className="text-right text-slate-100">
              {result.rank} of {total}
            </dd>
            <dt className="text-slate-400" title="5th–95th percentile across 1,000 random weightings">
              Rank range
            </dt>
            <dd className="text-right text-slate-100">{rankRange ? `${rankRange.p5}–${rankRange.p95}` : '–'}</dd>
            {sensitivityRanks.map((s) => (
              <FragmentRow key={s.label} label={s.label} value={`#${s.rank}`} />
            ))}
          </dl>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="label-mono">Analysis window · 20 × 20 km</p>
            <Tabs value={view} onValueChange={(v) => setView(v as View)}>
              <TabsList className="h-7">
                <TabsTrigger value="imagery" className="px-2 text-[11px]">Image</TabsTrigger>
                <TabsTrigger value="hillshade" className="px-2 text-[11px]">Relief</TabsTrigger>
                <TabsTrigger value="slope" className="px-2 text-[11px]">Slope</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Thumb src={reference.quicklooks[view]} label={`${reference.short} · ${BODY[reference.body].label}`} accent="var(--reference)" />
            <Thumb src={site.quicklooks?.[view]} label="Earth site" accent={role.color} />
          </div>
          <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-slate-400">
            {view === 'imagery'
              ? `Context imagery only: ${reference.body === 'mars' ? 'Mars CTX orthomosaic (USGS)' : 'average Sun visibility at the lunar south pole (PGDA; dark = more shadow)'} and Sentinel-2 cloudless (EOX). Not used in scoring.`
              : view === 'hillshade'
                ? 'Shaded relief of the elevation grid actually scored (100 m cells).'
                : 'Slope from the scored grid, 0° (dark) to 30°+ (light).'}
          </p>
        </div>

        <div>
          <p className="label-mono mb-2">Why it scores this way</p>
          <ScoreBreakdown result={result} reference={referenceValues} referenceLabel={reference.short} indicators={indicators} weights={weights} />
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            {mismatches.length === 0
              ? 'No indicator falls below 50 similarity under the current weights.'
              : `Mismatch on ${mismatches.map((m) => m.label.toLowerCase()).join(', ')}. A high overall score never means the places are the same.`}
          </p>
        </div>

        {site.role === 'screened' && (
          <div className="rounded-lg border border-screen/30 bg-screen/[0.06] p-4">
            <p className="label-mono text-screen">Unreviewed screening result</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">{site.context}</p>
            <p className="mt-2 text-xs text-slate-400">
              {site.nearestKnown ? `${site.nearestKnown.km} km from ${site.nearestKnown.name} (a site already in the curated list).` : 'More than 50 km from every curated site.'}{' '}
              Expert and field review would be needed before calling it an analog.
            </p>
          </div>
        )}

        {site.context && site.role !== 'screened' && (
          <div className="rounded-lg border border-border bg-ink-850 p-4">
            <p className="label-mono">Documented context · not scored</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">{site.context}</p>
            {evidence}
            {site.source && (
              <a href={site.source} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] text-data hover:underline">
                Source <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right text-slate-100">{value}</dd>
    </>
  )
}

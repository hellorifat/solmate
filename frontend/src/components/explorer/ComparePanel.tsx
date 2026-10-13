import { X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { IndicatorMeta, Reference } from '@/data/schema'
import type { SiteResult } from '@/science/analysis'
import { asset } from '@/lib/asset'
import { fmtValue, pct } from '@/lib/format'
import { ROLE } from './roles'

interface Props {
  a: SiteResult
  b: SiteResult
  reference: Reference
  referenceValues: number[]
  indicators: IndicatorMeta[]
  onClose: () => void
  onRemove: (id: string) => void
}

const COLORS = ['var(--data)', 'var(--screen)'] as const

/** Two Earth candidates against the same planetary reference, indicator by indicator. */
export function ComparePanel({ a, b, reference, referenceValues, indicators, onClose, onRemove }: Props) {
  const reduced = useReducedMotion()
  const pair = [a, b]
  return (
    <article className="flex h-full flex-col" aria-label="Compare two sites">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="label-mono">Compare · against {reference.short}</p>
          <h2 className="mt-1 text-lg font-semibold">Side by side</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-ink-700 hover:text-slate-100" aria-label="Close comparison">
          <X className="size-4" />
        </button>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-3 gap-2">
          <figure className="space-y-1.5">
            <img src={asset(reference.quicklooks.hillshade)} alt={`${reference.short} relief`} className="aspect-square w-full rounded-lg border border-reference/40 object-cover" />
            <figcaption className="truncate font-mono text-[10px] uppercase tracking-wider text-reference">{reference.short}</figcaption>
          </figure>
          {pair.map((r, i) => (
            <figure key={r.site.id} className="space-y-1.5">
              <div className="relative">
                {r.site.quicklooks ? (
                  <img src={asset(r.site.quicklooks.hillshade)} alt={`${r.site.name} relief`} className="aspect-square w-full rounded-lg border object-cover" style={{ borderColor: COLORS[i] }} />
                ) : (
                  <div className="grid aspect-square w-full place-items-center rounded-lg border border-border font-mono text-[10px] text-slate-400">no preview</div>
                )}
                <button type="button" onClick={() => onRemove(r.site.id)} className="absolute right-1 top-1 rounded bg-ink-950/80 p-0.5 text-slate-300 hover:text-slate-100" aria-label={`Remove ${r.site.name} from comparison`}>
                  <X className="size-3" />
                </button>
              </div>
              <figcaption className="truncate text-[11px] font-medium" style={{ color: COLORS[i] }} title={r.site.name}>
                {r.site.name}
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {pair.map((r, i) => (
            <div key={r.site.id} className="rounded-lg border border-border bg-ink-850 p-3">
              <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: ROLE[r.site.role].color }}>
                {ROLE[r.site.role].short} · rank {r.rank}
              </p>
              <p className="mt-1 text-3xl tabular" style={{ color: COLORS[i] }}>
                {pct(r.score)}
                <span className="text-sm text-slate-400">/100</span>
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {indicators.map((m, j) => (
            <div key={m.id} className="rounded-lg border border-border bg-ink-850 px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] text-slate-200">{m.label}</span>
                <span className="font-mono text-[11px] text-reference">{fmtValue(referenceValues[j]!, m.unit)}</span>
              </div>
              {pair.map((r, i) => (
                <div key={r.site.id} className="mt-1.5 grid grid-cols-[1fr_4rem_2.5rem] items-center gap-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-600">
                    <motion.div className="h-full rounded-full" style={{ background: COLORS[i] }} initial={false} animate={{ width: `${r.sims[j]! * 100}%` }} transition={{ duration: reduced ? 0 : 0.5 }} />
                  </div>
                  <span className="text-right font-mono text-[11px] tabular text-slate-200">{fmtValue(r.values[j]!, m.unit)}</span>
                  <span className="text-right font-mono text-[11px] tabular text-slate-400">{Math.round(r.sims[j]! * 100)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-slate-400">Bars show similarity to {reference.short} for each indicator (0–100); numbers are the measured values.</p>
      </div>
    </article>
  )
}

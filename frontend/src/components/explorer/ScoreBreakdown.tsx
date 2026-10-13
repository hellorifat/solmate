import { motion, useReducedMotion } from 'motion/react'
import type { IndicatorMeta } from '@/data/schema'
import type { SiteResult } from '@/science/analysis'
import { fmtValue } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Props {
  result: SiteResult
  reference: number[]
  referenceLabel: string
  indicators: IndicatorMeta[]
  weights: Record<string, number>
}

/** Per-indicator explanation: reference vs site value, similarity, and its share of the overall score. */
export function ScoreBreakdown({ result, reference, referenceLabel, indicators, weights }: Props) {
  const reduced = useReducedMotion()
  const total = indicators.reduce((s, m) => s + (weights[m.id] ?? 0), 0)
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 px-1 pb-1">
        <span className="label-mono">Indicator</span>
        <span className="label-mono truncate text-right text-reference" title={referenceLabel}>
          {referenceLabel.split(' ')[0]}
        </span>
        <span className="label-mono text-right text-data">Site</span>
      </div>
      {indicators.map((m, j) => {
        const sim = result.sims[j]!
        const gap = result.gaps[j]!
        const w = total > 0 ? (weights[m.id] ?? 0) / total : 0
        const mismatch = sim < 0.5
        return (
          <div key={m.id} className="rounded-lg border border-border bg-ink-850 px-3 py-2.5">
            <div className="grid grid-cols-[1fr_4.5rem_4.5rem] items-baseline gap-2">
              <span className="truncate text-[13px] text-slate-200" title={m.description}>
                {m.label}
              </span>
              <span className="text-right font-mono text-xs tabular text-slate-300">{fmtValue(reference[j]!, m.unit)}</span>
              <span className="text-right font-mono text-xs tabular text-slate-100">{fmtValue(result.values[j]!, m.unit)}</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink-600" aria-hidden="true">
                <motion.div
                  className={cn('h-full rounded-full', mismatch ? 'bg-negative/80' : 'bg-data')}
                  initial={false}
                  animate={{ width: `${sim * 100}%` }}
                  transition={{ duration: reduced ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <span className="w-28 shrink-0 text-right font-mono text-[11px] tabular text-slate-400">
                <span className="text-slate-200">{Math.round(sim * 100)}</span> sim · {Math.round(w * 100)}% wt
              </span>
            </div>
            <p className="mt-1.5 font-mono text-[10.5px] text-slate-400">
              {Math.abs(gap) < 0.25 ? 'Close match' : `${gap > 0 ? 'Higher' : 'Lower'} than ${referenceLabel} by ${Math.abs(gap).toFixed(1)} σ`}
              {mismatch && <span className="text-negative"> · mismatch</span>}
            </p>
          </div>
        )
      })}
    </div>
  )
}

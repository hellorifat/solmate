import { RotateCcw } from 'lucide-react'
import type { IndicatorMeta } from '@/data/schema'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
  indicators: IndicatorMeta[]
  weights: Record<string, number>
  isDefault: boolean
  onChange: (id: string, value: number) => void
  onReset: () => void
  onBalanced: () => void
  isBalanced: boolean
}

export function WeightPanel({ indicators, weights, isDefault, onChange, onReset, onBalanced, isBalanced }: Props) {
  const total = indicators.reduce((s, m) => s + (weights[m.id] ?? 0), 0)
  return (
    <section aria-labelledby="weights-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="weights-heading" className="label-mono">
          Indicator weights
        </h2>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onBalanced}
                aria-pressed={isBalanced}
                className="rounded px-1.5 py-0.5 font-mono text-[11px] text-slate-400 transition-colors hover:text-slate-100 aria-pressed:text-data"
              >
                Balanced
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-64 text-xs leading-relaxed">
              Median slope, local relief and ruggedness are almost perfectly correlated. This preset gives that group the same total weight as each
              independent indicator.
            </TooltipContent>
          </Tooltip>
          <button
            type="button"
            onClick={onReset}
            aria-pressed={isDefault}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] text-slate-400 transition-colors hover:text-slate-100 aria-pressed:text-data"
          >
            <RotateCcw className="size-3" /> Equal
          </button>
        </div>
      </div>
      <div className="space-y-3.5">
        {indicators.map((m) => {
          const w = weights[m.id] ?? 0
          const share = total > 0 ? w / total : 0
          return (
            <div key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <label htmlFor={`w-${m.id}`} className="cursor-help truncate text-[13px] text-slate-200 underline decoration-ink-500 decoration-dotted underline-offset-4">
                    {m.label}
                  </label>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-64 text-xs leading-relaxed">
                  {m.description}
                </TooltipContent>
              </Tooltip>
              <span className="font-mono text-[11px] tabular text-slate-400" aria-hidden="true">
                {Math.round(share * 100)}%
              </span>
              <Slider
                id={`w-${m.id}`}
                className="col-span-2"
                min={0}
                max={1}
                step={0.05}
                value={[w]}
                onValueChange={([v]) => onChange(m.id, v ?? 0)}
                aria-label={`${m.label} weight`}
                aria-valuetext={`${Math.round(share * 100)} percent of the score`}
              />
            </div>
          )
        })}
      </div>
      {total === 0 && <p className="text-xs text-negative">Give at least one indicator a weight to compute scores.</p>}
    </section>
  )
}

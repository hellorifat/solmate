import { motion, useReducedMotion } from 'motion/react'
import { Columns2 } from 'lucide-react'
import type { SiteResult } from '@/science/analysis'
import type { ValidationDoc } from '@/data/schema'
import { cn } from '@/lib/utils'
import { pct } from '@/lib/format'
import { ROLE } from './roles'

interface Props {
  results: SiteResult[]
  selectedId: string | null
  hoveredId: string | null
  compare: string[]
  rankRange?: ValidationDoc['weight_perturbation']['rank_range']
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  onToggleCompare: (id: string) => void
  label: string
  limit?: number
}

export function RankList({ results, selectedId, hoveredId, compare, rankRange, onSelect, onHover, onToggleCompare, label, limit }: Props) {
  const reduced = useReducedMotion()
  const shown = limit ? results.slice(0, limit) : results
  return (
    <ol className="space-y-1" aria-label={label}>
      {shown.map((r) => {
        const role = ROLE[r.site.role]
        const range = rankRange?.[r.site.id]
        const active = r.site.id === selectedId
        const comparing = compare.includes(r.site.id)
        return (
          <motion.li
            key={r.site.id}
            layout={!reduced}
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            className={cn('group relative rounded-lg transition-colors', active ? 'bg-ink-700' : hoveredId === r.site.id ? 'bg-ink-800' : 'hover:bg-ink-800')}
            onMouseEnter={() => onHover(r.site.id)}
            onMouseLeave={() => onHover(null)}
          >
            <button
              type="button"
              onClick={() => onSelect(r.site.id)}
              aria-current={active ? 'true' : undefined}
              className="grid w-full grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-lg py-2 pl-2.5 pr-10 text-left"
            >
              <span className="text-xs tabular text-slate-400">{String(r.rank).padStart(2, '0')}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={r.site.role === 'control' ? { boxShadow: `inset 0 0 0 1.5px ${role.color}` } : { background: role.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm font-medium text-slate-100">{r.site.name}</span>
                </span>
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-ink-600">
                    <motion.span
                      className="block h-full rounded-full"
                      style={{ background: role.color }}
                      initial={false}
                      animate={{ width: `${r.score * 100}%` }}
                      transition={{ duration: reduced ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </span>
                  <span className="w-20 shrink-0 truncate font-mono text-[10px] text-slate-400" title={range ? 'Rank range across 1,000 random weightings (5th–95th percentile)' : undefined}>
                    {range ? `rank ${range.p5}–${range.p95}` : r.site.country ?? ''}
                  </span>
                </span>
              </span>
              <span className="text-sm tabular text-slate-100">{pct(r.score)}</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleCompare(r.site.id)}
              aria-pressed={comparing}
              aria-label={`${comparing ? 'Remove' : 'Add'} ${r.site.name} ${comparing ? 'from' : 'to'} comparison`}
              title="Compare"
              className={cn(
                'absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 transition-all',
                comparing ? 'bg-data/15 text-data opacity-100' : 'text-slate-400 opacity-0 hover:bg-ink-600 hover:text-slate-100 focus-visible:opacity-100 group-hover:opacity-100 max-lg:opacity-60',
              )}
            >
              <Columns2 className="size-3.5" />
            </button>
          </motion.li>
        )
      })}
    </ol>
  )
}

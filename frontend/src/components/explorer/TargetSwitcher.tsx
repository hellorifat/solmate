import { motion } from 'motion/react'
import type { TargetSummary } from '@/data/schema'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/utils'
import { spring } from '@/design/motion'
import { BODY } from './roles'

/** Choose the planetary target; every score, chart and map layer follows it. */
export function TargetSwitcher({ targets, value, onChange, pillId = 'target-pill' }: { targets: TargetSummary[]; value: string; onChange: (id: string) => void; pillId?: string }) {
  return (
    <div role="radiogroup" aria-label="Planetary target" className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-ink-950/60 p-1">
      {targets.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(t.id)}
            className={cn('relative flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors', active ? 'text-slate-100' : 'text-slate-400 hover:text-slate-200')}
          >
            {active && <motion.span layoutId={pillId} transition={spring} className="absolute inset-0 rounded-lg border border-border bg-ink-700" />}
            <img src={asset(t.quicklooks.imagery ?? t.quicklooks.hillshade)} alt="" className="relative size-9 shrink-0 rounded-md object-cover" />
            <span className="relative min-w-0">
              <span className="block font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: BODY[t.body].color }}>
                {BODY[t.body].label}
              </span>
              <span className="block truncate text-[13px] font-medium">{t.short}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

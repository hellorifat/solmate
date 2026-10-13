import { useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import type { TargetSummary } from '@/data/schema'
import type { TargetBundle } from '@/hooks/useAllTargets'
import { fmtValue, pct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { spring } from '@/design/motion'
import { BODY, ROLE } from '@/components/explorer/roles'
import { CompareSlider } from './CompareSlider'

type View = 'hillshade' | 'slope' | 'imagery'

/**
 * Side-by-side look at the planetary target and one of its best Earth matches:
 * a drag-to-compare terrain view plus the five indicator values that drive the score.
 */
export function TargetShowcase({ target, bundle }: { target: TargetSummary; bundle: TargetBundle }) {
  const top = bundle.analysis.results.filter((r) => r.site.quicklooks).slice(0, 4)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [view, setView] = useState<View>('hillshade')
  const match = top.find((r) => r.site.id === pickedId) ?? top[0]
  if (!match) return null

  const meta = bundle.indicators.profile.indicators
  const ids = bundle.analysis.indicatorIds
  const views: { id: View; label: string }[] = [
    { id: 'hillshade', label: 'Shaded relief' },
    { id: 'slope', label: 'Slope' },
    { id: 'imagery', label: target.body === 'moon' ? 'Imagery · sunlight' : 'Imagery' },
  ]
  const explorerLink = `/explorer?${new URLSearchParams({ ...(target.id !== 'jezero' && { target: target.id }), site: match.site.id })}`

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:gap-8">
      <div className="space-y-3">
        <CompareSlider
          view={view}
          left={{ label: target.short, sub: BODY[target.body].label, quicklooks: target.quicklooks, accent: BODY[target.body].color }}
          right={{ label: match.site.name, sub: `Earth · rank ${match.rank}`, quicklooks: match.site.quicklooks ?? {}, accent: ROLE[match.site.role].color }}
        />
        <div role="radiogroup" aria-label="Terrain view" className="flex flex-wrap gap-1.5">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={view === v.id}
              onClick={() => setView(v.id)}
              className={cn(
                'relative h-9 rounded-full px-3.5 text-xs transition-colors',
                view === v.id ? 'text-ink-900' : 'border border-border text-slate-300 hover:text-slate-100',
              )}
            >
              {view === v.id && <motion.span layoutId={`view-pill-${target.id}`} transition={spring} className="absolute inset-0 rounded-full bg-slate-100" />}
              <span className="relative">{v.label}</span>
            </button>
          ))}
        </div>
        {view === 'imagery' && target.body === 'moon' && (
          <p className="text-xs text-slate-400">The lunar side shows average Sun visibility (PGDA, LOLA-derived): bright means sunlit more often. The Earth side is Sentinel-2 cloudless.</p>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <p className="label-mono">Compare with</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {top.map((r) => (
              <button
                key={r.site.id}
                type="button"
                aria-pressed={r.site.id === match.site.id}
                onClick={() => setPickedId(r.site.id)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left transition-colors',
                  r.site.id === match.site.id ? 'border-slate-300/60 bg-ink-700' : 'border-border bg-card hover:bg-ink-800',
                )}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-slate-100">{r.site.name}</span>
                  <span className="font-mono text-sm tabular text-slate-100">{pct(r.score)}</span>
                </span>
                <span className="block truncate font-mono text-[10px]" style={{ color: ROLE[r.site.role].color }}>
                  #{r.rank} · {ROLE[r.site.role].short}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <p className="label-mono">Indicator match</p>
            <p className="font-mono text-[11px] text-slate-400">
              <span style={{ color: BODY[target.body].color }}>{BODY[target.body].label}</span> vs Earth
            </p>
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.ul key={match.site.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-3 space-y-3">
              {ids.map((id, i) => {
                const m = meta.find((x) => x.id === id)
                return (
                  <li key={id}>
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="truncate text-slate-300">{m?.label ?? id}</span>
                      <span className="shrink-0 font-mono tabular text-slate-400">
                        {fmtValue(bundle.analysis.reference[i]!, m?.unit ?? '')} · {fmtValue(match.values[i]!, m?.unit ?? '')}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-700">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: match.sims[i]! > 0.75 ? 'var(--positive)' : match.sims[i]! > 0.4 ? 'var(--reference)' : 'var(--mars)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(3, match.sims[i]! * 100)}%` }}
                        transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                  </li>
                )
              })}
            </motion.ul>
          </AnimatePresence>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-400">Bar = how close each indicator is (full bar = identical). Overall score is their equal-weight mean.</p>
        </div>

        <Link to={explorerLink} className="inline-flex items-center gap-1.5 self-start font-mono text-sm text-data hover:underline">
          Open {match.site.name} in the explorer <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}

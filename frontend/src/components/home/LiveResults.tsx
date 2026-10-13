import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import type { TargetSummary } from '@/data/schema'
import type { TargetBundle } from '@/hooks/useAllTargets'
import { asset } from '@/lib/asset'
import { pct } from '@/lib/format'
import { ROLE } from '@/components/explorer/roles'
import { CountUp } from './CountUp'

/** Top of the equal-weight ranking and the validation headline for one target, read from the pipeline artifacts. */
export function LiveResults({ target, bundle }: { target: TargetSummary; bundle: TargetBundle }) {
  const top = bundle.analysis.results.slice(0, 5)
  const r = bundle.validation.retrieval
  const docInTop5 = top.filter((t) => t.site.role === 'documented').length
  const small = bundle.validation.sensitivity.find((c) => c.id === 'smaller-window')?.auc_documented
  const q = (site: string) => `/explorer?${new URLSearchParams({ ...(target.id !== 'jezero' && { target: target.id }), site })}`

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {top.map((t, i) => (
          <motion.li key={`${target.id}-${t.site.id}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05, duration: 0.35 }}>
            <Link to={q(t.site.id)} className="group grid grid-cols-[2rem_3rem_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-800 sm:grid-cols-[2.5rem_3rem_1fr_auto] sm:gap-4">
              <span className="font-mono text-xs text-slate-400">#{t.rank}</span>
              {t.site.quicklooks ? (
                <img src={asset(t.site.quicklooks.hillshade)} alt="" className="size-12 rounded-md object-cover" loading="lazy" />
              ) : (
                <span className="size-12 rounded-md bg-ink-700" />
              )}
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-100">{t.site.name}</span>
                <span className="block truncate font-mono text-[11px]" style={{ color: ROLE[t.site.role].color }}>
                  {ROLE[t.site.role].short}
                  {t.site.country && ` · ${t.site.country}`}
                </span>
              </span>
              <span className="flex items-center gap-2 text-lg tabular text-slate-100">
                {pct(t.score)}
                <ArrowRight className="size-4 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-200" />
              </span>
            </Link>
          </motion.li>
        ))}
      </ol>
      <div className="flex flex-col justify-between gap-6 rounded-xl border border-border bg-card p-6">
        <div>
          <p className="label-mono">Method check · {target.short}</p>
          <p className="mt-3 text-5xl text-positive">
            <CountUp key={target.id} value={r.auc_documented} decimals={2} />
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Probability that a site NASA pairs with the {target.pair} outscores a negative control (farmland, rainforest, glacier). 0.5 would be chance.{' '}
            {docInTop5} of the top five are NASA-documented {target.pair} analogs.
          </p>
        </div>
        <div className="space-y-2 text-xs text-slate-400">
          {small !== undefined && <p>Scale-sensitive: {small.toFixed(2)} in a 12 km window.</p>}
          <Link to="/method#validation" className="inline-flex items-center gap-1 font-mono text-data hover:underline">
            Strengths and weaknesses <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}

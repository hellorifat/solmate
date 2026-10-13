import { CircleCheck, CircleHelp, CircleX, CircleDashed } from 'lucide-react'
import type { ClaimsDoc } from '@/data/schema'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type Result = ClaimsDoc['results'][string]

const STYLE = {
  supported: { icon: CircleCheck, label: 'Evidence-checked', color: 'var(--positive)' },
  needs_review: { icon: CircleHelp, label: 'Needs human review', color: 'var(--reference)' },
  contradicted: { icon: CircleX, label: 'Contradicted by source', color: 'var(--negative)' },
  not_checked: { icon: CircleDashed, label: 'Not checked', color: 'var(--slate-400)' },
} as const

/** Shows whether the stored source excerpt supports the context claim (TypeSafe Choice + confidence gate). */
export function EvidenceBadge({ result, doc }: { result?: Result; doc: ClaimsDoc | null }) {
  const status = result?.status ?? 'not_checked'
  const s = STYLE[status]
  const Icon = s.icon
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="mt-3 inline-flex cursor-help items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px]" style={{ color: s.color, borderColor: `color-mix(in oklab, ${s.color} 40%, transparent)` }}>
          <Icon className="size-3.5" /> {s.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72 space-y-1 text-xs leading-relaxed">
        {result?.relation ? (
          <>
            <p>
              Source excerpt judged <strong>{result.relation.replace('_', ' ')}</strong> at confidence {result.confidence?.toFixed(2)} (threshold{' '}
              {doc?.threshold}).
            </p>
            <p className="text-muted-foreground">
              {doc?.model ? `TypeSafe ${doc.model}. ` : ''}A decision aid for this text only; it does not affect any score.
            </p>
          </>
        ) : (
          <p>{result?.reason ? `Not checked: ${result.reason}.` : 'No evidence check available.'}</p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

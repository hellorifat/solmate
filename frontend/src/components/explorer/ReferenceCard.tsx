import type { Reference } from '@/data/schema'
import { asset } from '@/lib/asset'
import { fmtCoord } from '@/lib/format'
import { BODY } from './roles'

export function ReferenceCard({ reference }: { reference: Reference }) {
  return (
    <div className="flex gap-3 rounded-lg border border-reference/25 bg-reference/[0.06] p-2.5">
      <img
        src={asset(reference.quicklooks.imagery ?? reference.quicklooks.hillshade)}
        alt={reference.name}
        className="size-16 shrink-0 rounded-md object-cover"
      />
      <div className="min-w-0">
        <p className="label-mono text-reference">Reference · {BODY[reference.body].label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold">{reference.name}</p>
        <p className="mt-0.5 font-mono text-[10.5px] text-slate-400">{fmtCoord(reference.lat, reference.lon)} · {reference.body === 'mars' ? 'CTX DTM 20 m' : 'LOLA DEM 20 m'}</p>
      </div>
    </div>
  )
}

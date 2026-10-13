import { ExternalLink } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState, PanelSkeleton } from '@/components/common/States'
import { useAllTargets, type AllTargets } from '@/hooks/useAllTargets'
import { ROLE } from '@/components/explorer/roles'
import { fmtCoord } from '@/lib/format'

export default function DataPage() {
  const state = useAllTargets()
  return (
    <>
      <PageHeader
        kicker="Data provenance"
        title="Where every number comes from."
        lead="Each dataset, licence and processing step behind the explorer. Scored inputs are marked separately from imagery shown only for context."
      />
      {state.status === 'loading' && (
        <div className="mx-auto w-full max-w-5xl px-6">
          <PanelSkeleton />
        </div>
      )}
      {state.status === 'error' && <ErrorState title="Provenance could not be loaded." detail={state.error.message} onRetry={() => location.reload()} />}
      {state.status === 'ready' && <DataBody data={state.data} />}
    </>
  )
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-t border-border py-2.5 text-sm first:border-t-0">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="text-slate-200">{value}</dd>
    </div>
  )
}

function DataBody({ data }: { data: AllTargets }) {
  const { provenance: p, screening } = data.common
  const bundles = data.common.targets.targets.map((t) => ({ t, doc: data.byId[t.id]!.indicators }))
  const doc = bundles[0]!.doc
  return (
    <div className="mx-auto w-full max-w-5xl space-y-16 px-6 pb-24">
      <section aria-labelledby="datasets">
        <h2 id="datasets" className="label-mono mb-5">
          Datasets
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {p.datasets.map((d) => {
            const scored = d.role.toLowerCase().includes('scored') && !d.role.toLowerCase().includes('not scored')
            return (
              <article key={d.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="label-mono" style={{ color: scored ? 'var(--positive)' : undefined }}>
                      {d.body} · {d.role}
                    </p>
                    <h3 className="mt-2 font-semibold leading-snug text-slate-100">{d.name}</h3>
                    <p className="mt-1 text-xs text-slate-400">{d.provider}</p>
                  </div>
                  <a href={d.url} target="_blank" rel="noreferrer" className="rounded-md p-1.5 text-slate-400 hover:bg-ink-700 hover:text-slate-100" aria-label={`Open ${d.name}`}>
                    <ExternalLink className="size-4" />
                  </a>
                </div>
                <dl className="mt-4">
                  <Field label="Resolution" value={d.resolution} />
                  <Field label="Coverage" value={d.coverage} />
                  <Field label="Licence" value={d.licence} />
                  <Field label="Quality" value={d.quality} />
                  <Field label="Attribution" value={d.attribution} />
                  <Field label="Citation" value={d.citation} />
                  <Field label="DOI" value={d.doi} />
                </dl>
              </article>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="processing">
        <h2 id="processing" className="label-mono mb-5">
          Processing
        </h2>
        <ol className="space-y-3">
          {p.processing.map((step, i) => (
            <li key={step} className="grid grid-cols-[2rem_1fr] gap-3 text-[15px] leading-relaxed text-slate-300">
              <span className="font-mono text-xs text-slate-400">{String(i + 1).padStart(2, '0')}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="sites">
        <h2 id="sites" className="label-mono mb-5">
          Sites and elevation tiles
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-ink-850">
              <tr className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 font-normal">Site</th>
                <th className="px-4 py-3 font-normal">Role</th>
                <th className="px-4 py-3 font-normal">Centre</th>
                <th className="px-4 py-3 text-right font-normal">Valid cells</th>
                <th className="px-4 py-3 font-normal">GLO-30 tiles</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map(({ t, doc: d }) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-3 text-slate-100">{d.reference.name}</td>
                  <td className="px-4 py-3 text-reference">Reference · {t.pair}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{fmtCoord(d.reference.lat, d.reference.lon)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular">{Math.round(d.reference.valid_fraction * 100)}%</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{t.body === 'mars' ? 'CTX DTM mosaic' : 'LOLA LDEM 80°S 20 m'}</td>
                </tr>
              ))}
              {doc.sites.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 text-slate-100">
                    {s.source ? (
                      <a href={s.source} target="_blank" rel="noreferrer" className="hover:text-data hover:underline">
                        {s.name}
                      </a>
                    ) : (
                      s.name
                    )}
                    <span className="block text-xs text-slate-400">{s.country}</span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: ROLE[s.role].color }}>
                    {ROLE[s.role].short}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{fmtCoord(s.lat, s.lon)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular">{Math.round(s.valid_fraction * 100)}%</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                    {(p.sites[s.id]?.tiles ?? []).map((t) => t.replace('Copernicus_DSM_COG_10_', '').replace('_DEM', '')).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {screening && (
        <section aria-labelledby="screening">
          <h2 id="screening" className="label-mono mb-5">
            Regional screening
          </h2>
          <p className="mb-5 max-w-3xl text-[15px] leading-relaxed text-slate-300">
            {screening.windows.length} windows of {screening.window_m / 1000} km on a {screening.cell_m} m grid, sampled across {screening.regions.length} regions
            from the same GLO-30 tiles. Windows with less than 90% valid cells or more than 5% water were dropped. Results are unreviewed leads, not analogs.
          </p>
          <ul className="flex flex-wrap gap-2">
            {screening.regions.map((r) => (
              <li key={r.id} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-slate-300">
                {r.name} <span className="text-slate-500">· {r.country}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="software" className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 id="software" className="label-mono mb-4">
            Software
          </h2>
          <dl className="rounded-xl border border-border bg-card px-5 py-2">
            {Object.entries(p.software).map(([k, v]) => (
              <Field key={k} label={k} value={v} />
            ))}
          </dl>
        </div>
        <div>
          <h2 className="label-mono mb-4">Reproduce</h2>
          <pre className="overflow-x-auto rounded-xl border border-border bg-ink-950 p-5 font-mono text-xs leading-relaxed text-slate-300">
            {`cd analysis
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m pytest -q tests
.venv/Scripts/python run.py`}
          </pre>
          <p className="mt-3 font-mono text-[11px] text-slate-400">Artifacts generated {new Date(p.generated_at).toUTCString()}</p>
        </div>
      </section>
    </div>
  )
}

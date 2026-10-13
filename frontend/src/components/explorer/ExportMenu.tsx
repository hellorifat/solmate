import { Download } from 'lucide-react'
import { toast } from 'sonner'
import type { AnalysisResult, SiteResult } from '@/science/analysis'
import type { IndicatorsDoc } from '@/data/schema'
import { Button } from '@/components/ui/button'

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const NEEDS_QUOTES = /[",\n]/

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return NEEDS_QUOTES.test(s) ? `"${s.split('"').join('""')}"` : s
}

interface Props {
  doc: IndicatorsDoc
  analysis: AnalysisResult
  weights: Record<string, number>
  includeScreened: boolean
}

/** Downloads exactly what is on screen: current target, weights, ranking, indicators and per-indicator similarity. */
export function ExportMenu({ doc, analysis, weights, includeScreened }: Props) {
  const ids = analysis.indicatorIds
  const rows: (SiteResult & { list: string })[] = [
    ...analysis.results.map((r) => ({ ...r, list: 'curated' })),
    ...(includeScreened ? analysis.screened.map((r) => ({ ...r, list: 'screened' })) : []),
  ]
  const base = () => `solmate-${doc.reference.id}-${new Date().toISOString().slice(0, 10)}`

  const toCsv = () => {
    const head = ['list', 'rank', 'id', 'name', 'country', 'lat', 'lon', 'role', 'score', ...ids.map((k) => `value_${k}`), ...ids.map((k) => `similarity_${k}`)]
    const lines = rows.map((r) =>
      [r.list, r.rank, r.site.id, r.site.name, r.site.country, r.site.lat, r.site.lon, r.site.role, r.score.toFixed(6), ...r.values.map((v) => v.toFixed(4)), ...r.sims.map((v) => v.toFixed(6))]
        .map(csvCell)
        .join(','),
    )
    const meta = [
      '# SolMate terrain-analog ranking',
      `# target: ${doc.reference.name} (${doc.reference.body})`,
      `# weights: ${ids.map((k) => `${k}=${weights[k]}`).join(' ')}`,
      `# window ${doc.profile.window_m} m, cell ${doc.profile.cell_m} m; artifacts generated ${doc.generated_at}`,
    ]
    download(`${base()}.csv`, 'text/csv', [...meta, head.join(','), ...lines].join('\n'))
    toast.success('Ranking exported as CSV')
  }

  const toJson = () => {
    const body = {
      target: { id: doc.reference.id, name: doc.reference.name, body: doc.reference.body, indicators: doc.reference.indicators },
      method: 'robust-z gaussian similarity, weighted mean',
      weights,
      scaling: Object.fromEntries(ids.map((k, j) => [k, { centre: analysis.scaling.centre[j], scale: analysis.scaling.scale[j] }])),
      window_m: doc.profile.window_m,
      cell_m: doc.profile.cell_m,
      artifacts_generated_at: doc.generated_at,
      results: rows.map((r) => ({
        list: r.list,
        rank: r.rank,
        id: r.site.id,
        name: r.site.name,
        country: r.site.country,
        lat: r.site.lat,
        lon: r.site.lon,
        role: r.site.role,
        score: r.score,
        values: Object.fromEntries(ids.map((k, j) => [k, r.values[j]])),
        similarity: Object.fromEntries(ids.map((k, j) => [k, r.sims[j]])),
      })),
    }
    download(`${base()}.json`, 'application/json', JSON.stringify(body, null, 1))
    toast.success('Ranking exported as JSON')
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="xs" onClick={toCsv} className="font-mono text-[11px] text-slate-400 hover:text-slate-100" aria-label="Export ranking as CSV">
        <Download /> CSV
      </Button>
      <Button variant="ghost" size="xs" onClick={toJson} className="font-mono text-[11px] text-slate-400 hover:text-slate-100" aria-label="Export ranking as JSON">
        JSON
      </Button>
    </div>
  )
}

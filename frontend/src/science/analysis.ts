import type { IndicatorsDoc, ScreeningDoc, Site } from '@/data/schema'
import { contributions, perIndicatorSimilarity, rank, robustScaling, weightedScore, zGap, type Scaling } from './similarity'

export type CandidateRole = Site['role'] | 'screened'

/** A place that can be scored: a curated site or a screened window. */
export interface Candidate {
  id: string
  name: string
  country: string | null
  lat: number
  lon: number
  role: CandidateRole
  pair: string | null
  context: string | null
  source: string | null
  quicklooks?: { hillshade: string; slope: string; imagery?: string }
  region?: string
  nearestKnown?: { name: string; km: number } | null
}

export interface SiteResult {
  site: Candidate
  values: number[]
  sims: number[]
  gaps: number[]
  contributions: number[]
  score: number
  rank: number
}

export interface AnalysisResult {
  indicatorIds: string[]
  reference: number[]
  scaling: Scaling
  results: SiteResult[] // curated sites, sorted by rank
  screened: SiteResult[] // screened windows, sorted by rank among themselves
  byId: Map<string, SiteResult>
}

export function equalWeights(ids: readonly string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, 1]))
}

function toCandidate(s: Site): Candidate {
  return { ...s, role: s.role }
}

function score(cands: Candidate[], matrix: number[][], reference: number[], scaling: Scaling, w: number[]): SiteResult[] {
  const partial = cands.map((site, i) => {
    const values = matrix[i]!
    const sims = perIndicatorSimilarity(reference, values, scaling.scale)
    return { site, values, sims, gaps: zGap(reference, values, scaling.scale), contributions: contributions(sims, w), score: weightedScore(sims, w) }
  })
  const ranks = rank(
    partial.map((p) => p.score),
    partial.map((p) => p.site.id),
  )
  return partial.map((p, i) => ({ ...p, rank: ranks[i]! })).sort((a, b) => a.rank - b.rank)
}

/**
 * Deterministic analysis of every curated site (and optionally every screened window) against the reference.
 * Screened windows use the curated pool's robust scaling, exactly as analysis/screen.py does, so scores are comparable.
 */
export function analyse(doc: IndicatorsDoc, weights: Record<string, number>, screening?: ScreeningDoc | null): AnalysisResult {
  const indicatorIds = doc.profile.scored
  const pool = doc.sites.filter((s) => !s.excluded)
  const matrix = pool.map((s) => indicatorIds.map((k) => s.indicators[k]!))
  const reference = indicatorIds.map((k) => doc.reference.indicators[k]!)
  const scaling = robustScaling(matrix)
  const w = indicatorIds.map((k) => weights[k] ?? 0)

  const results = score(pool.map(toCandidate), matrix, reference, scaling, w)

  let screened: SiteResult[] = []
  if (screening) {
    const regions = new Map(screening.regions.map((r) => [r.id, r]))
    const cands: Candidate[] = screening.windows.map((win) => {
      const reg = regions.get(win.region)
      return {
        id: win.id,
        name: `${reg?.name ?? win.region} · ${Math.abs(win.lat).toFixed(2)}°${win.lat >= 0 ? 'N' : 'S'} ${Math.abs(win.lon).toFixed(2)}°${win.lon >= 0 ? 'E' : 'W'}`,
        country: reg?.country ?? null,
        lat: win.lat,
        lon: win.lon,
        role: 'screened',
        pair: null,
        context: reg ? `Screened window in a ${reg.type} region. Terrain similarity only; not reviewed by experts.` : null,
        source: null,
        quicklooks: win.quicklooks,
        region: win.region,
        nearestKnown: win.nearest_known,
      }
    })
    screened = score(
      cands,
      screening.windows.map((win) => indicatorIds.map((k) => win.indicators[k]!)),
      reference,
      scaling,
      w,
    )
  }
  return { indicatorIds, reference, scaling, results, screened, byId: new Map([...results, ...screened].map((r) => [r.site.id, r])) }
}

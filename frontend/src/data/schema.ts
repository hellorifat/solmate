import { z } from 'zod'

// Runtime schemas for the static artifacts written by analysis/run.py.
// Parsing at load time means a malformed or stale file surfaces as a clear error state, not a broken chart.

const indicatorValues = z.record(z.string(), z.number())

export const IndicatorMeta = z.object({
  id: z.string(),
  label: z.string(),
  unit: z.string(),
  description: z.string(),
})

const quicklooks = z.object({ hillshade: z.string(), slope: z.string(), imagery: z.string().optional() })

export const Site = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string().nullable(),
  lat: z.number(),
  lon: z.number(),
  role: z.enum(['documented', 'candidate', 'control']),
  pair: z.string().nullable(),
  context: z.string().nullable(),
  source: z.string().nullable(),
  indicators: indicatorValues,
  valid_fraction: z.number(),
  elev_range: z.number(),
  excluded: z.boolean(),
  quicklooks,
  elev_min: z.number(),
  elev_max: z.number(),
})

export const Reference = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string(),
  body: z.enum(['mars', 'moon']),
  pair: z.string(),
  lat: z.number(),
  lon: z.number(),
  note: z.string(),
  source: z.string(),
  indicators: indicatorValues,
  valid_fraction: z.number(),
  elev_range: z.number(),
  quicklooks,
  elev_min: z.number(),
  elev_max: z.number(),
})

export const Config = z.object({
  id: z.string(),
  label: z.string(),
  window_m: z.number(),
  cell_m: z.number(),
  reference: indicatorValues,
  sites: z.record(z.string(), indicatorValues),
})

export const IndicatorsDoc = z.object({
  version: z.literal(1),
  generated_at: z.string(),
  profile: z.object({
    id: z.string(),
    label: z.string(),
    window_m: z.number(),
    cell_m: z.number(),
    indicators: z.array(IndicatorMeta),
    scored: z.array(z.string()),
    note: z.string(),
  }),
  reference: Reference,
  sites: z.array(Site),
  configs: z.array(Config),
})

const rankRange = z.object({ p5: z.number(), p50: z.number(), p95: z.number(), min: z.number(), max: z.number() })
const triple = z.object({ p5: z.number(), p50: z.number(), p95: z.number() })

export const ValidationDoc = z.object({
  version: z.literal(1),
  generated_at: z.string(),
  target: z.string(),
  method: z.string(),
  pool: z.array(z.string()),
  excluded: z.array(z.string()),
  scaling: z.object({ centre: indicatorValues, scale: indicatorValues }),
  equal_weights: z.object({
    scores: indicatorValues,
    per_indicator: z.record(z.string(), indicatorValues),
    ranks: indicatorValues,
  }),
  retrieval: z.object({
    pair: z.string(),
    positives: z.string(),
    negatives: z.string(),
    auc_documented: z.number(),
    auc_all_documented: z.number(),
    n_positive: z.number(),
    n_negative: z.number(),
    top5: z.array(z.string()),
    documented_in_top5: z.number(),
    controls_in_top5: z.number(),
    mean_rank: z.object({ documented_pair: z.number(), documented_all: z.number(), control: z.number() }),
  }),
  weight_perturbation: z.object({
    n: z.number(),
    seed: z.number(),
    distribution: z.string(),
    rank_range: z.record(z.string(), rankRange),
    auc_documented: triple,
  }),
  sensitivity: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      window_m: z.number(),
      cell_m: z.number(),
      auc_documented: z.number(),
      spearman_vs_primary: z.number(),
      ranks: indicatorValues,
    }),
  ),
  correlation: z.object({ order: z.array(z.string()), matrix: z.array(z.array(z.number())) }),
})

export const ProvenanceDoc = z.object({
  version: z.literal(1),
  generated_at: z.string(),
  datasets: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      provider: z.string(),
      body: z.string(),
      role: z.string(),
      resolution: z.string().optional(),
      coverage: z.string().optional(),
      url: z.string(),
      doi: z.string().optional(),
      licence: z.string(),
      attribution: z.string().optional(),
      citation: z.string().optional(),
      quality: z.string().optional(),
    }),
  ),
  processing: z.array(z.string()),
  sites: z.record(z.string(), z.object({ tiles: z.array(z.string()), valid_fraction: z.number() })),
  software: z.record(z.string(), z.string()),
})

export type IndicatorsDoc = z.infer<typeof IndicatorsDoc>
export type ValidationDoc = z.infer<typeof ValidationDoc>
export type ProvenanceDoc = z.infer<typeof ProvenanceDoc>
export type Site = z.infer<typeof Site>
export type Reference = z.infer<typeof Reference>
export type IndicatorMeta = z.infer<typeof IndicatorMeta>

export const ClaimsDoc = z.object({
  version: z.literal(1),
  generated_at: z.string(),
  checker: z.string(),
  model: z.string().nullable(),
  threshold: z.number(),
  scope: z.string(),
  results: z.record(
    z.string(),
    z.object({
      claim: z.string().nullable(),
      source: z.string().nullable(),
      status: z.enum(['supported', 'needs_review', 'contradicted', 'not_checked']),
      reason: z.string().optional(),
      relation: z.string().optional(),
      confidence: z.number().optional(),
      probabilities: z.record(z.string(), z.number()).optional(),
    }),
  ),
})
export type ClaimsDoc = z.infer<typeof ClaimsDoc>

export const TargetsDoc = z.object({
  version: z.literal(1),
  generated_at: z.string(),
  targets: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      short: z.string(),
      body: z.enum(['mars', 'moon']),
      pair: z.string(),
      lat: z.number(),
      lon: z.number(),
      note: z.string(),
      quicklooks,
      indicators: indicatorValues,
      auc_documented: z.number(),
      top: z.array(z.object({ id: z.string(), score: z.number() })),
    }),
  ),
})
export type TargetsDoc = z.infer<typeof TargetsDoc>
export type TargetSummary = TargetsDoc['targets'][number]

export const ScreenWindow = z.object({
  id: z.string(),
  region: z.string(),
  lat: z.number(),
  lon: z.number(),
  indicators: indicatorValues,
  valid_fraction: z.number(),
  elev_min: z.number(),
  elev_max: z.number(),
  nearest_known: z.object({ name: z.string(), km: z.number() }).nullable(),
  quicklooks: quicklooks.optional(),
})
export type ScreenWindow = z.infer<typeof ScreenWindow>

export const ScreeningDoc = z.object({
  version: z.literal(1),
  generated_at: z.string(),
  window_m: z.number(),
  cell_m: z.number(),
  method: z.string(),
  status: z.string(),
  regions: z.array(z.object({ id: z.string(), name: z.string(), country: z.string(), type: z.string(), box: z.array(z.number()) })),
  windows: z.array(ScreenWindow),
  top_equal_weights: z.record(z.string(), z.array(z.object({ id: z.string(), score: z.number() }))),
})
export type ScreeningDoc = z.infer<typeof ScreeningDoc>

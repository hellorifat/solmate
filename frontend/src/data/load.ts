import { asset } from '@/lib/asset'
import { ClaimsDoc, IndicatorsDoc, ProvenanceDoc, ScreeningDoc, TargetsDoc, ValidationDoc } from './schema'

/** Artifacts shared by every target. Claims and screening are optional: the app works without them. */
export interface CommonData {
  targets: TargetsDoc
  provenance: ProvenanceDoc
  claims: ClaimsDoc | null
  screening: ScreeningDoc | null
}

/** Artifacts for one planetary target. */
export interface TargetData {
  indicators: IndicatorsDoc
  validation: ValidationDoc
}

export interface AnalysisData extends CommonData, TargetData {}

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(asset(path))
  if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status})`)
  return res.json()
}

const optional = <T,>(p: Promise<unknown>, parse: (x: unknown) => T): Promise<T | null> => p.then(parse).catch(() => null)

let common: Promise<CommonData> | null = null
const perTarget = new Map<string, Promise<TargetData>>()

export function loadCommon(): Promise<CommonData> {
  common ??= Promise.all([
    fetchJson('data/targets.v1.json').then((x) => TargetsDoc.parse(x)),
    fetchJson('data/provenance.v1.json').then((x) => ProvenanceDoc.parse(x)),
    optional(fetchJson('data/claims.v1.json'), (x) => ClaimsDoc.parse(x)),
    optional(fetchJson('data/screening.v1.json'), (x) => ScreeningDoc.parse(x)),
  ])
    .then(([targets, provenance, claims, screening]) => ({ targets, provenance, claims, screening }))
    .catch((err) => {
      common = null // allow retry
      throw err
    })
  return common
}

export function loadTarget(id: string): Promise<TargetData> {
  let p = perTarget.get(id)
  if (!p) {
    p = Promise.all([fetchJson(`data/indicators.${id}.v1.json`), fetchJson(`data/validation.${id}.v1.json`)])
      .then(([i, v]) => ({ indicators: IndicatorsDoc.parse(i), validation: ValidationDoc.parse(v) }))
      .catch((err) => {
        perTarget.delete(id)
        throw err
      })
    perTarget.set(id, p)
  }
  return p
}

export async function loadAnalysisData(targetId: string): Promise<AnalysisData> {
  const c = await loadCommon()
  const id = c.targets.targets.some((t) => t.id === targetId) ? targetId : c.targets.targets[0]!.id
  return { ...c, ...(await loadTarget(id)) }
}

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { IndicatorsDoc, ScreeningDoc, TargetsDoc, ValidationDoc } from '@/data/schema'
import { analyse, equalWeights } from './analysis'
import { auc, contributions, perIndicatorSimilarity, rank, robustScaling, weightedScore } from './similarity'

const load = (name: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../public/data/${name}`, import.meta.url)), 'utf8'))

describe('similarity primitives', () => {
  it('identical profiles score exactly 1', () => {
    const sims = perIndicatorSimilarity([1, 2, 3], [1, 2, 3], [1, 1, 1])
    expect(weightedScore(sims, [1, 2, 3])).toBe(1)
  })

  it('is invariant to weight scaling and indicator order', () => {
    const ref = [1, 5, 9]
    const cand = [2, 3, 12]
    const scale = [1, 2, 3]
    const sims = perIndicatorSimilarity(ref, cand, scale)
    const a = weightedScore(sims, [1, 2, 3])
    expect(weightedScore(sims, [10, 20, 30])).toBeCloseTo(a, 12)
    const perm = [2, 0, 1]
    const simsP = perIndicatorSimilarity(
      perm.map((i) => ref[i]!),
      perm.map((i) => cand[i]!),
      perm.map((i) => scale[i]!),
    )
    expect(weightedScore(simsP, perm.map((i) => [1, 2, 3][i]!))).toBeCloseTo(a, 12)
  })

  it('contributions sum to the score', () => {
    const sims = [0.9, 0.2, 0.5]
    const w = [1, 3, 0.5]
    const total = contributions(sims, w).reduce((s, c) => s + c, 0)
    expect(total).toBeCloseTo(weightedScore(sims, w), 12)
  })

  it('robust scaling uses median and 1.4826 × MAD', () => {
    const { centre, scale } = robustScaling([[1], [2], [3], [4], [100]])
    expect(centre[0]).toBe(3)
    expect(scale[0]).toBeCloseTo(1.4826, 10)
  })

  it('ranks ties deterministically by id and computes AUC', () => {
    expect(rank([0.5, 0.9, 0.5], ['b', 'a', 'a2'])).toEqual([3, 1, 2])
    expect(auc([3, 4], [1, 2])).toBe(1)
    expect(auc([1], [1])).toBe(0.5)
  })
})

const targets = TargetsDoc.parse(load('targets.v1.json')).targets.map((t) => t.id)

describe.each(targets)('agreement with the Python pipeline artifacts: %s', (target) => {
  const doc = IndicatorsDoc.parse(load(`indicators.${target}.v1.json`))
  const val = ValidationDoc.parse(load(`validation.${target}.v1.json`))
  const res = analyse(doc, equalWeights(doc.profile.scored))

  it('reproduces the robust scaling', () => {
    doc.profile.scored.forEach((k, j) => {
      expect(res.scaling.centre[j]).toBeCloseTo(val.scaling.centre[k]!, 9)
      expect(res.scaling.scale[j]).toBeCloseTo(val.scaling.scale[k]!, 9)
    })
  })

  it('reproduces every equal-weight score and rank within 1e-9', () => {
    expect(res.results.map((r) => r.site.id).sort()).toEqual([...val.pool].sort())
    for (const r of res.results) {
      expect(r.score).toBeCloseTo(val.equal_weights.scores[r.site.id]!, 9)
      expect(r.rank).toBe(val.equal_weights.ranks[r.site.id])
    }
  })

  it('reproduces the known-analog retrieval AUC', () => {
    const pos = res.results.filter((r) => r.site.role === 'documented' && r.site.pair === val.retrieval.pair).map((r) => r.score)
    const neg = res.results.filter((r) => r.site.role === 'control').map((r) => r.score)
    expect(auc(pos, neg)).toBeCloseTo(val.retrieval.auc_documented, 12)
  })
})

describe('screened windows use the curated scaling', () => {
  const screeningPath = new URL('../../public/data/screening.v1.json', import.meta.url)
  const doc = IndicatorsDoc.parse(load('indicators.jezero.v1.json'))
  it.skipIf(!existsSync(fileURLToPath(screeningPath)))('matches the Python top-10 equal-weight scores', () => {
    const screening = ScreeningDoc.parse(load('screening.v1.json'))
    const res = analyse(doc, equalWeights(doc.profile.scored), screening)
    for (const top of screening.top_equal_weights['jezero'] ?? []) {
      expect(res.byId.get(top.id)!.score).toBeCloseTo(top.score, 9)
    }
  })
})

/**
 * SolMate terrain similarity: mirrors analysis/similarity.py exactly.
 *
 *  1. Robust centre/scale per indicator over the Earth pool: median and 1.4826 × MAD
 *     (standard deviation if MAD is zero, 1 if both are zero).
 *  2. Per-indicator similarity s_i = exp(-((x_cand − x_ref) / scale_i)² / 2) ∈ (0, 1].
 *  3. Overall S = Σ w_i s_i / Σ w_i.
 *
 * Pure functions only: no React, no I/O.
 */

export type Vector = readonly number[]

export const MAD_TO_SIGMA = 1.4826

function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const n = s.length
  if (n === 0) return Number.NaN
  const mid = Math.floor(n / 2)
  return n % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

function std(values: readonly number[]): number {
  const m = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length)
}

export interface Scaling {
  centre: number[]
  scale: number[]
}

/** pool: rows = sites, columns = indicators */
export function robustScaling(pool: readonly Vector[]): Scaling {
  const k = pool[0]?.length ?? 0
  const centre: number[] = []
  const scale: number[] = []
  for (let j = 0; j < k; j++) {
    const col = pool.map((r) => r[j]!)
    const c = median(col)
    const mad = median(col.map((v) => Math.abs(v - c))) * MAD_TO_SIGMA
    const sd = std(col)
    centre.push(c)
    scale.push(mad > 1e-12 ? mad : sd > 1e-12 ? sd : 1)
  }
  return { centre, scale }
}

export function perIndicatorSimilarity(ref: Vector, cand: Vector, scale: Vector): number[] {
  return cand.map((v, j) => {
    const dz = (v - ref[j]!) / scale[j]!
    return Math.exp(-0.5 * dz * dz)
  })
}

/** z-distance (signed, in robust standard deviations) of a candidate from the reference per indicator */
export function zGap(ref: Vector, cand: Vector, scale: Vector): number[] {
  return cand.map((v, j) => (v - ref[j]!) / scale[j]!)
}

export function weightedScore(sims: Vector, weights: Vector): number {
  let num = 0
  let den = 0
  for (let j = 0; j < sims.length; j++) {
    const w = Math.max(0, weights[j] ?? 0)
    num += w * sims[j]!
    den += w
  }
  return den > 0 ? num / den : Number.NaN
}

/** Share of the total score contributed by each indicator (sums to the score). */
export function contributions(sims: Vector, weights: Vector): number[] {
  const den = weights.reduce((a, w) => a + Math.max(0, w), 0)
  return sims.map((s, j) => (den > 0 ? (Math.max(0, weights[j] ?? 0) * s) / den : 0))
}

/** 1 = most similar; ties broken by id for determinism (matches the Python ranking). */
export function rank(scores: readonly number[], ids: readonly string[]): number[] {
  const order = ids.map((_, i) => i).sort((a, b) => scores[b]! - scores[a]! || ids[a]!.localeCompare(ids[b]!))
  const r = new Array<number>(ids.length)
  order.forEach((i, pos) => {
    r[i] = pos + 1
  })
  return r
}

/** Probability a random positive outscores a random negative; ties count half. */
export function auc(pos: readonly number[], neg: readonly number[]): number {
  let wins = 0
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0
  return wins / (pos.length * neg.length)
}

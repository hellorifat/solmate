"""Reference implementation of SolMate's terrain similarity (mirrored by frontend/src/science/similarity.ts).

Method
  1. For each indicator, robust centre and scale over the Earth candidate pool:
     median and 1.4826 x MAD (falls back to the standard deviation if MAD is zero).
  2. Standardise the reference and each candidate: z = (x - centre) / scale.
  3. Per-indicator similarity s_i = exp(-(z_cand - z_ref)^2 / 2), in (0, 1].
  4. Overall score S = sum(w_i s_i) / sum(w_i). Equal weights unless the user changes them.
"""
from __future__ import annotations

import numpy as np

MAD_TO_SIGMA = 1.4826


def robust_scaling(pool: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """pool: (n_sites, n_indicators). Returns (centre, scale) per indicator."""
    centre = np.median(pool, axis=0)
    mad = np.median(np.abs(pool - centre), axis=0) * MAD_TO_SIGMA
    std = pool.std(axis=0)
    scale = np.where(mad > 1e-12, mad, np.where(std > 1e-12, std, 1.0))
    return centre, scale


def per_indicator_similarity(ref: np.ndarray, cand: np.ndarray, centre: np.ndarray, scale: np.ndarray) -> np.ndarray:
    dz = (cand - ref) / scale  # centre cancels; kept in the signature for clarity of the method
    return np.exp(-0.5 * dz ** 2)


def score(sims: np.ndarray, weights: np.ndarray) -> np.ndarray:
    """sims: (n_sites, n_indicators); weights: (n_indicators,) >= 0."""
    w = np.asarray(weights, dtype=float)
    return (sims * w).sum(axis=-1) / w.sum()


def ranks(scores: np.ndarray, ids: list[str]) -> list[int]:
    """1 = most similar. Ties broken by id for determinism."""
    order = sorted(range(len(ids)), key=lambda i: (-scores[i], ids[i]))
    r = [0] * len(ids)
    for pos, i in enumerate(order):
        r[i] = pos + 1
    return r


def auc(pos_scores: np.ndarray, neg_scores: np.ndarray) -> float:
    """Probability that a random positive outscores a random negative (ties count half)."""
    p = np.asarray(pos_scores)[:, None]
    n = np.asarray(neg_scores)[None, :]
    return float(((p > n).sum() + 0.5 * (p == n).sum()) / (p.size * n.size))


def spearman(a: np.ndarray, b: np.ndarray) -> float:
    ra = np.argsort(np.argsort(a)).astype(float)
    rb = np.argsort(np.argsort(b)).astype(float)
    return float(np.corrcoef(ra, rb)[0, 1])

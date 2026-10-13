"""Terrain indicators computed identically for Earth and Mars elevation grids.

All functions take a 2-D float array of elevations in metres on a square grid with
`cell` metres spacing. NaN marks missing data. Edge pixels that lack a full
neighbourhood are excluded from every statistic, so results do not depend on padding.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict

import numpy as np
from scipy import ndimage

INDICATORS = ("slope_median", "slope_p90", "local_relief", "ruggedness", "hypsometric_integral")


def _shift(z: np.ndarray, dy: int, dx: int) -> np.ndarray:
    """z shifted so out[i, j] = z[i + dy, j + dx]; borders become NaN."""
    out = np.full_like(z, np.nan)
    h, w = z.shape
    ys = slice(max(0, -dy), h - max(0, dy))
    xs = slice(max(0, -dx), w - max(0, dx))
    yd = slice(max(0, dy), h - max(0, -dy))
    xd = slice(max(0, dx), w - max(0, -dx))
    out[ys, xs] = z[yd, xd]
    return out


def slope_deg(z: np.ndarray, cell: float) -> np.ndarray:
    """Slope in degrees with Horn's (1981) 3x3 finite-difference method."""
    a, b, c = _shift(z, -1, -1), _shift(z, -1, 0), _shift(z, -1, 1)
    d, f = _shift(z, 0, -1), _shift(z, 0, 1)
    g, h, i = _shift(z, 1, -1), _shift(z, 1, 0), _shift(z, 1, 1)
    dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * cell)
    dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * cell)
    return np.degrees(np.arctan(np.hypot(dzdx, dzdy)))


def ruggedness(z: np.ndarray) -> np.ndarray:
    """Terrain Ruggedness Index (Riley et al. 1999): root of summed squared differences to the 8 neighbours, in metres."""
    acc = np.zeros_like(z)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            acc = acc + (_shift(z, dy, dx) - z) ** 2
    return np.sqrt(acc)


def local_relief(z: np.ndarray, cell: float, radius_m: float = 500.0) -> np.ndarray:
    """Max minus min elevation within a square moving window of side 2*radius (default 1 km), in metres."""
    k = int(round(radius_m / cell))
    size = 2 * k + 1
    filled = np.where(np.isnan(z), np.nanmean(z), z)
    rel = ndimage.maximum_filter(filled, size=size, mode="nearest") - ndimage.minimum_filter(filled, size=size, mode="nearest")
    # windows touching missing data or the grid edge are not valid
    bad = ndimage.maximum_filter(np.isnan(z).astype(np.uint8), size=size, mode="constant", cval=1) > 0
    rel[bad] = np.nan
    return rel


def hypsometric_integral(z: np.ndarray) -> float:
    """(mean - low) / (high - low) using the 1st and 99th percentiles for robustness to spikes."""
    v = z[np.isfinite(z)]
    lo, hi = np.percentile(v, [1, 99])
    if hi - lo < 1e-6:
        return float("nan")
    return float((np.clip(v, lo, hi).mean() - lo) / (hi - lo))


@dataclass
class Indicators:
    slope_median: float          # degrees
    slope_p90: float             # degrees
    local_relief: float          # metres, median over the window
    ruggedness: float            # metres, median TRI
    hypsometric_integral: float  # dimensionless, 0..1
    valid_fraction: float        # share of finite elevation cells
    elev_range: float            # metres, p99 - p1 (context only, never scored)

    def as_dict(self) -> dict:
        return asdict(self)


def compute_indicators(z: np.ndarray, cell: float) -> Indicators:
    s = slope_deg(z, cell)
    t = ruggedness(z)
    r = local_relief(z, cell)
    sv, tv, rv = s[np.isfinite(s)], t[np.isfinite(t)], r[np.isfinite(r)]
    v = z[np.isfinite(z)]
    lo, hi = np.percentile(v, [1, 99])
    return Indicators(
        slope_median=float(np.median(sv)),
        slope_p90=float(np.percentile(sv, 90)),
        local_relief=float(np.median(rv)),
        ruggedness=float(np.median(tv)),
        hypsometric_integral=hypsometric_integral(z),
        valid_fraction=float(np.isfinite(z).mean()),
        elev_range=float(hi - lo),
    )


def hillshade(z: np.ndarray, cell: float, azimuth: float = 315.0, altitude: float = 40.0) -> np.ndarray:
    """Standard illumination model, 0..1, for quicklook images only."""
    dzdy, dzdx = np.gradient(np.where(np.isnan(z), np.nanmean(z), z), cell)
    slope = np.arctan(np.hypot(dzdx, dzdy))
    aspect = np.arctan2(-dzdx, dzdy)
    az, alt = np.radians(azimuth), np.radians(altitude)
    hs = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    return np.clip(hs, 0, 1)

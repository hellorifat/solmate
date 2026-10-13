"""Analytic checks for the terrain indicators on synthetic grids."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import terrain  # noqa: E402

CELL = 100.0


def plane(deg: float, n: int = 64) -> np.ndarray:
    x = np.arange(n) * CELL
    return np.tile(np.tan(np.radians(deg)) * x, (n, 1))


@pytest.mark.parametrize("deg", [0.0, 5.0, 20.0, 45.0])
def test_slope_of_plane_is_exact(deg):
    ind = terrain.compute_indicators(plane(deg), CELL)
    assert ind.slope_median == pytest.approx(deg, abs=1e-9)
    assert ind.slope_p90 == pytest.approx(deg, abs=1e-9)


def test_ruggedness_of_plane():
    # neighbours differ by d along x and diagonals, 0 along y: TRI = sqrt(6) * d
    deg = 10.0
    d = math.tan(math.radians(deg)) * CELL
    ind = terrain.compute_indicators(plane(deg), CELL)
    assert ind.ruggedness == pytest.approx(math.sqrt(6) * d, rel=1e-9)


def test_local_relief_of_plane():
    # a 1 km window (11 cells) spans 10 cell steps of rise
    deg = 10.0
    d = math.tan(math.radians(deg)) * CELL
    ind = terrain.compute_indicators(plane(deg), CELL)
    assert ind.local_relief == pytest.approx(10 * d, rel=1e-9)


def test_flat_grid_is_zero_and_hi_is_nan():
    z = np.full((50, 50), 123.0)
    ind = terrain.compute_indicators(z, CELL)
    assert ind.slope_median == 0 and ind.ruggedness == 0 and ind.local_relief == 0
    assert math.isnan(ind.hypsometric_integral)


def test_hypsometric_integral_of_cone_and_bowl():
    n = 201
    y, x = np.mgrid[:n, :n] - n // 2
    r = np.hypot(x, y)
    cone = np.clip(100 - r, 0, None)          # mostly low ground with a peak -> low HI
    bowl = np.clip(r, None, 100)              # mostly high ground with a pit -> high HI
    assert terrain.hypsometric_integral(cone) < 0.3
    assert terrain.hypsometric_integral(bowl) > 0.6


def test_missing_data_is_excluded():
    z = plane(10.0)
    z[:, :8] = np.nan
    ind = terrain.compute_indicators(z, CELL)
    assert ind.slope_median == pytest.approx(10.0, abs=1e-9)
    assert ind.valid_fraction == pytest.approx(1 - 8 / 64)


def test_indicator_order_is_stable():
    assert terrain.INDICATORS == ("slope_median", "slope_p90", "local_relief", "ruggedness", "hypsometric_integral")

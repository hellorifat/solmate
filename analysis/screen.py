"""Screen Earth regions for new analog candidates.

Samples 20 km windows on a regular grid inside arid, polar and volcanic regions, computes the same
terrain indicators, and writes them for the frontend to score against each target (with the same
robust scaling as the curated pool, so screened and curated scores are comparable).

These are unreviewed candidates: terrain similarity only, at one scale, from a surface model.
Any of them needs expert and field review before it could be called an analog.

    python screen.py              # ~280 windows; cached DEM windows make re-runs fast
    python screen.py --per-region 6
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
from pathlib import Path

import numpy as np
import yaml

import fetch
import run
import similarity as sim
import terrain

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "frontend" / "public" / "data"
WINDOW_M, CELL_M = 20_000, 100
SPACING_DEG = 0.3          # grid spacing in latitude (~33 km) so 20 km windows never overlap
NEAR_KNOWN_KM = 50
MAX_ZERO_FRACTION = 0.05   # GLO-30 sets open water to 0 m; more than this means sea or large lakes

REGIONS = [
    {"id": "hoggar", "name": "Hoggar volcanic massif", "country": "Algeria", "type": "volcanic, arid", "box": (22.5, 24.5, 4.5, 6.5)},
    {"id": "tibesti", "name": "Tibesti Mountains", "country": "Chad", "type": "volcanic, arid", "box": (19.5, 21.5, 17.0, 19.0)},
    {"id": "harrat-khaybar", "name": "Harrat Khaybar lava field", "country": "Saudi Arabia", "type": "lava field", "box": (24.5, 26.0, 39.5, 40.8)},
    {"id": "afar", "name": "Afar and Danakil", "country": "Ethiopia / Eritrea", "type": "volcanic, salt", "box": (12.5, 14.5, 40.0, 41.5)},
    {"id": "lut", "name": "Lut Desert", "country": "Iran", "type": "hyper-arid", "box": (29.5, 31.5, 58.5, 60.0)},
    {"id": "qaidam", "name": "Qaidam Basin", "country": "China", "type": "arid basin", "box": (37.0, 38.5, 91.0, 94.0)},
    {"id": "gobi", "name": "Gobi Desert", "country": "Mongolia", "type": "arid", "box": (43.0, 45.0, 101.0, 105.0)},
    {"id": "namib", "name": "Namib Desert", "country": "Namibia", "type": "hyper-arid", "box": (-25.0, -23.0, 15.0, 16.5)},
    {"id": "puna", "name": "Puna and Altiplano", "country": "Argentina / Chile", "type": "high desert, volcanic", "box": (-26.0, -22.0, -68.5, -66.5)},
    {"id": "pilbara", "name": "Pilbara", "country": "Australia", "type": "ancient arid terrain", "box": (-23.0, -21.0, 118.0, 120.0)},
    {"id": "great-basin", "name": "Great Basin and Mojave", "country": "USA", "type": "arid, volcanic", "box": (35.0, 39.0, -118.0, -114.0)},
    {"id": "iceland", "name": "Icelandic interior", "country": "Iceland", "type": "volcanic, cold", "box": (64.2, 65.2, -18.0, -15.5)},
    {"id": "canadian-arctic", "name": "Devon and Ellesmere islands", "country": "Canada", "type": "polar desert", "box": (75.0, 77.0, -92.0, -86.0)},
    {"id": "dry-valleys", "name": "McMurdo Dry Valleys", "country": "Antarctica", "type": "polar desert", "box": (-78.0, -77.0, 160.0, 163.0)},
]


def grid_points(box, per_region: int, seed: int) -> list[tuple[float, float]]:
    lat0, lat1, lon0, lon1 = box
    pts = []
    lat = lat0 + SPACING_DEG / 2
    while lat < lat1:
        dlon = SPACING_DEG / max(math.cos(math.radians(lat)), 0.2)
        lon = lon0 + dlon / 2
        while lon < lon1:
            pts.append((round(lat, 3), round(lon, 3)))
            lon += dlon
        lat += SPACING_DEG
    rng = np.random.default_rng(seed)
    if len(pts) > per_region:
        idx = rng.choice(len(pts), size=per_region, replace=False)
        pts = [pts[i] for i in sorted(idx)]
    return pts


def haversine_km(a, b) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-region", type=int, default=20)
    ap.add_argument("--thumbs", type=int, default=6, help="imagery thumbnails for the top N per target")
    args = ap.parse_args()

    cfg = yaml.safe_load((ROOT / "sites.yaml").read_text(encoding="utf-8"))
    known = [(s["lat"], s["lon"], s["name"]) for s in cfg["sites"]]
    windows = []
    for ri, reg in enumerate(REGIONS):
        for lat, lon in grid_points(reg["box"], args.per_region, seed=1000 + ri):
            try:
                z, m = fetch.earth_window(lat, lon, WINDOW_M, CELL_M)
            except Exception as err:  # network hiccup: skip this window, keep the run going
                print("skip", reg["id"], lat, lon, type(err).__name__)
                continue
            valid = float(np.isfinite(z).mean())
            zero = float((z == 0).mean())
            if valid < run.MIN_VALID or zero > MAX_ZERO_FRACTION:
                continue
            ind = terrain.compute_indicators(z, CELL_M).as_dict()
            near = min(known, key=lambda k: haversine_km((lat, lon), k[:2]))
            dist = haversine_km((lat, lon), near[:2])
            windows.append({
                "id": f"{reg['id']}-{lat:+.2f}{lon:+.2f}".replace("+", "p").replace("-", "m").replace(".", "_"),
                "region": reg["id"], "lat": lat, "lon": lon,
                "indicators": {k: ind[k] for k in run.IND},
                "valid_fraction": valid,
                "elev_min": float(np.nanmin(z)), "elev_max": float(np.nanmax(z)),
                "nearest_known": {"name": near[2], "km": round(dist, 1)} if dist <= NEAR_KNOWN_KM else None,
            })
            print(f"{reg['id']:<16} {lat:7.2f} {lon:8.2f} ok ({len(windows)})", flush=True)

    # equal-weight scores per target with the curated pool's scaling, for thumbnails and a summary
    summary = {}
    for t in json.loads((OUT / "targets.v1.json").read_text(encoding="utf-8"))["targets"]:
        val = json.loads((OUT / f"validation.{t['id']}.v1.json").read_text(encoding="utf-8"))
        scale = np.array([val["scaling"]["scale"][k] for k in run.IND])
        ref = np.array([t["indicators"][k] for k in run.IND])
        X = np.array([[w["indicators"][k] for k in run.IND] for w in windows])
        sc = sim.score(sim.per_indicator_similarity(ref, X, None, scale), np.ones(len(run.IND)))
        order = np.argsort(-sc)
        summary[t["id"]] = [{"id": windows[i]["id"], "score": float(sc[i])} for i in order[:10]]
        for i in order[: args.thumbs]:
            w = windows[i]
            if "quicklooks" in w:
                continue
            z, _ = fetch.earth_window(w["lat"], w["lon"], WINDOW_M, CELL_M)
            w["quicklooks"] = run.save_quicklooks(f"screen-{w['id']}", z, CELL_M, fetch.s2_thumbnail(w["lat"], w["lon"], WINDOW_M))

    doc = {
        "version": 1,
        "generated_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "window_m": WINDOW_M, "cell_m": CELL_M,
        "method": "Regular grid (0.3° latitude spacing) inside each region, random subset per region (fixed seed); windows with <90% valid cells or >5% open water are dropped.",
        "status": "Unreviewed candidates: terrain similarity only. Expert and field review are required before any site is called an analog.",
        "regions": [{k: r[k] for k in ("id", "name", "country", "type")} | {"box": list(r["box"])} for r in REGIONS],
        "windows": windows,
        "top_equal_weights": summary,
    }
    (OUT / "screening.v1.json").write_text(json.dumps(doc, indent=1, ensure_ascii=False), encoding="utf-8")
    print("windows:", len(windows), "| top per target:", {k: v[0] for k, v in summary.items()})


if __name__ == "__main__":
    main()

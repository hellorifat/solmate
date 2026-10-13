"""Run the SolMate terrain-analog pipeline and write the static data artifacts used by the frontend.

    python run.py            # uses cached DEM windows when present
    python run.py --refresh  # re-download windows

Outputs (frontend/public/data/):
    targets.v1.json             list of planetary targets
    indicators.<target>.v1.json reference + site indicators for every analysis configuration
    validation.<target>.v1.json ranking, known-analog retrieval, weight perturbation, sensitivity
    provenance.v1.json          datasets, licences, processing steps, software versions
    quicklooks/*.webp           hillshade, slope and imagery thumbnails for each window
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import platform
import shutil
from pathlib import Path

import numpy as np
import rasterio
import scipy
import yaml
from PIL import Image

import fetch
import similarity as sim
import terrain

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "frontend" / "public" / "data"
QL = OUT / "quicklooks"

CONFIGS = [
    {"id": "primary", "label": "20 km window at 100 m", "window_m": 20_000, "cell_m": 100},
    {"id": "coarser-cells", "label": "20 km window at 200 m", "window_m": 20_000, "cell_m": 200},
    {"id": "smaller-window", "label": "12 km window at 100 m", "window_m": 12_000, "cell_m": 100},
]
MIN_VALID = 0.9
N_PERTURB = 1000
SEED = 42

INDICATOR_META = [
    {"id": "slope_median", "label": "Median slope", "unit": "°",
     "description": "Typical steepness of the ground, from Horn's 3×3 gradient on the 100 m grid."},
    {"id": "slope_p90", "label": "Steep slopes (90th-percentile slope)", "unit": "°",
     "description": "Slope exceeded by the steepest 10% of the window: scarps, crater walls, channel banks."},
    {"id": "local_relief", "label": "Local relief", "unit": "m",
     "description": "Median elevation range inside a moving 1 km square: how much the ground rises and falls over rover-traverse distances."},
    {"id": "ruggedness", "label": "Terrain ruggedness (TRI)", "unit": "m",
     "description": "Riley's Terrain Ruggedness Index: elevation change between each 100 m cell and its eight neighbours."},
    {"id": "hypsometric_integral", "label": "Hypsometric integral", "unit": "",
     "description": "Where the average elevation sits between the window's low and high points (0 = mostly lowland, 1 = mostly upland)."},
]
IND = [m["id"] for m in INDICATOR_META]


def colour_ramp(v: np.ndarray, stops: list[tuple[float, tuple[int, int, int]]]) -> np.ndarray:
    v = np.clip(np.nan_to_num(v, nan=0.0), 0, 1)
    out = np.zeros(v.shape + (3,), dtype=np.float32)
    xs = [s[0] for s in stops]
    for c in range(3):
        out[..., c] = np.interp(v, xs, [s[1][c] for s in stops])
    return out.astype(np.uint8)


SLOPE_RAMP = [(0.0, (12, 18, 30)), (0.15, (40, 55, 110)), (0.35, (120, 80, 160)), (0.6, (225, 120, 90)), (1.0, (250, 230, 170))]


def save_quicklooks(site_id: str, z: np.ndarray, cell: float, imagery: Image.Image | None) -> dict:
    QL.mkdir(parents=True, exist_ok=True)
    hs = terrain.hillshade(z, cell)
    v = z[np.isfinite(z)]
    lo, hi = np.percentile(v, [2, 98])
    elev = np.clip((np.nan_to_num(z, nan=lo) - lo) / max(hi - lo, 1e-6), 0, 1)
    tint = colour_ramp(elev, [(0, (60, 70, 90)), (0.5, (150, 140, 120)), (1, (225, 215, 195))]).astype(np.float32)
    shaded = np.clip(tint * (0.35 + 0.75 * hs[..., None]), 0, 255).astype(np.uint8)
    slope = terrain.slope_deg(z, cell)
    files = {}
    for name, arr in (("hillshade", shaded), ("slope", colour_ramp(slope / 30.0, SLOPE_RAMP))):
        img = Image.fromarray(arr).resize((400, 400), Image.LANCZOS)
        p = QL / f"{site_id}-{name}.webp"
        img.save(p, quality=86)
        files[name] = f"data/quicklooks/{p.name}"
    if imagery is not None:
        p = QL / f"{site_id}-imagery.webp"
        imagery.convert("RGB").resize((400, 400), Image.LANCZOS).save(p, quality=84)
        files["imagery"] = f"data/quicklooks/{p.name}"
    return files


def ctx_imagery(lat: float, lon: float, size_m: float) -> Image.Image:
    o = fetch.mars_ortho_window(lat, lon, size_m, 25)
    v = o[np.isfinite(o)]
    lo, hi = np.percentile(v, [1, 99])
    g = np.clip((np.nan_to_num(o, nan=lo) - lo) / (hi - lo), 0, 1) ** 0.9
    rgb = np.stack([g * 236, g * 214, g * 196], axis=-1).astype(np.uint8)  # neutral warm grey, not false colour
    return Image.fromarray(rgb)


def sun_visibility_imagery(lat: float, lon: float, size_m: float) -> Image.Image:
    v = fetch.moon_sun_visibility(lat, lon, size_m)
    lo, hi = np.nanpercentile(v, [1, 99])
    g = np.clip((np.nan_to_num(v, nan=lo) - lo) / max(hi - lo, 1e-6), 0, 1)
    ramp = [(0.0, (8, 10, 18)), (0.35, (60, 52, 90)), (0.7, (200, 150, 90)), (1.0, (250, 236, 200))]
    return Image.fromarray(colour_ramp(g, ramp))


def reference_window(ref: dict, size_m: float, cell: float):
    if ref["dem"] == "ctx_jezero":
        return fetch.mars_window(ref["lat"], ref["lon"], size_m, cell)
    if ref["dem"] == "lola_80s_20m":
        return fetch.moon_window(ref["lat"], ref["lon"], size_m, cell)
    raise ValueError(ref["dem"])


def reference_imagery(ref: dict, size_m: float) -> Image.Image:
    return ctx_imagery(ref["lat"], ref["lon"], size_m) if ref["body"] == "mars" else sun_visibility_imagery(ref["lat"], ref["lon"], size_m)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()
    if args.refresh and fetch.CACHE.exists():
        for f in fetch.CACHE.glob("earth_*.npy"):
            f.unlink()

    cfg = yaml.safe_load((ROOT / "sites.yaml").read_text(encoding="utf-8"))
    refs = cfg["references"]
    sites = cfg["sites"]
    OUT.mkdir(parents=True, exist_ok=True)
    if QL.exists():  # keep thumbnails written by screen.py
        for f in QL.glob("*.webp"):
            if not f.name.startswith("screen-"):
                f.unlink()
    for old in OUT.glob("*.v1.json"):
        if old.name not in ("claims.v1.json", "screening.v1.json"):
            old.unlink()

    results: dict[str, dict] = {c["id"]: {} for c in CONFIGS}
    meta: dict[str, dict] = {}
    for c in CONFIGS:
        for ref in refs:
            z, m = reference_window(ref, c["window_m"], c["cell_m"])
            results[c["id"]][ref["id"]] = terrain.compute_indicators(z, c["cell_m"]).as_dict()
            if c["id"] == "primary":
                meta[ref["id"]] = {"dem": m, "quicklooks": save_quicklooks(ref["id"], z, c["cell_m"], reference_imagery(ref, c["window_m"])),
                                   "elev_min": float(np.nanmin(z)), "elev_max": float(np.nanmax(z))}
            print(f"{c['id']:<15} {ref['id']:<20} " + " ".join(f"{results[c['id']][ref['id']][k]:8.3f}" for k in IND))
        for s in sites:
            z, m = fetch.earth_window(s["lat"], s["lon"], c["window_m"], c["cell_m"])
            results[c["id"]][s["id"]] = terrain.compute_indicators(z, c["cell_m"]).as_dict()
            if c["id"] == "primary":
                img = fetch.s2_thumbnail(s["lat"], s["lon"], c["window_m"])
                meta[s["id"]] = {"dem": m, "quicklooks": save_quicklooks(s["id"], z, c["cell_m"], img),
                                 "elev_min": float(np.nanmin(z)), "elev_max": float(np.nanmax(z))}

    # data-quality gate (deterministic): drop windows with too little valid elevation
    excluded = sorted({s["id"] for s in sites for c in CONFIGS if results[c["id"]][s["id"]]["valid_fraction"] < MIN_VALID})
    earth = [s for s in sites if s["id"] not in excluded]
    ids = [s["id"] for s in earth]
    roles = {s["id"]: s["role"] for s in earth}
    pairs = {s["id"]: s.get("pair") for s in earth}
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    equal = np.ones(len(IND))
    targets_index = []

    for ref in refs:
        def evaluate(cid: str, weights: np.ndarray, ref=ref) -> dict:
            pool = np.array([[results[cid][i][k] for k in IND] for i in ids])
            refv = np.array([results[cid][ref["id"]][k] for k in IND])
            centre, scale = sim.robust_scaling(pool)
            sims = sim.per_indicator_similarity(refv, pool, centre, scale)
            sc = sim.score(sims, weights)
            return {"pool": pool, "ref": refv, "centre": centre, "scale": scale, "sims": sims, "scores": sc, "ranks": sim.ranks(sc, ids)}

        def retrieval(scores: np.ndarray, positive) -> float:
            pos = np.array([scores[k] for k, i in enumerate(ids) if positive(i)])
            neg = np.array([scores[k] for k, i in enumerate(ids) if roles[i] == "control"])
            return sim.auc(pos, neg)

        def is_pair_doc(i: str, ref=ref) -> bool:
            return roles[i] == "documented" and pairs[i] == ref["pair"]

        def is_doc(i: str) -> bool:
            return roles[i] == "documented"

        prim = evaluate("primary", equal)
        order = sorted(range(len(ids)), key=lambda k: prim["ranks"][k])
        top5 = [ids[k] for k in order[:5]]

        rng = np.random.default_rng(SEED)
        W = rng.dirichlet(np.ones(len(IND)), size=N_PERTURB)
        rank_samples = np.zeros((N_PERTURB, len(ids)), dtype=int)
        auc_samples = np.zeros(N_PERTURB)
        for t, w in enumerate(W):
            sc = sim.score(prim["sims"], w)
            rank_samples[t] = sim.ranks(sc, ids)
            auc_samples[t] = retrieval(sc, is_pair_doc)

        configs_out = []
        for c in CONFIGS:
            ev = prim if c["id"] == "primary" else evaluate(c["id"], equal)
            configs_out.append({
                "id": c["id"], "label": c["label"], "window_m": c["window_m"], "cell_m": c["cell_m"],
                "auc_documented": retrieval(ev["scores"], is_pair_doc),
                "spearman_vs_primary": sim.spearman(np.asarray(ev["scores"]), np.asarray(prim["scores"])),
                "ranks": {i: ev["ranks"][k] for k, i in enumerate(ids)},
            })

        indicators_doc = {
            "version": 1,
            "generated_at": now,
            "profile": {
                "id": "terrain-morphometry",
                "label": "Terrain morphometry (rover traverse scale)",
                "window_m": CONFIGS[0]["window_m"],
                "cell_m": CONFIGS[0]["cell_m"],
                "indicators": INDICATOR_META,
                "scored": IND,
                "note": "Absolute elevation is never compared; only derived terrain metrics on the same physical grid.",
            },
            "reference": {
                **{k: ref[k] for k in ("id", "name", "short", "body", "pair", "lat", "lon", "note", "source")},
                "indicators": {k: results["primary"][ref["id"]][k] for k in IND},
                "valid_fraction": results["primary"][ref["id"]]["valid_fraction"],
                "elev_range": results["primary"][ref["id"]]["elev_range"],
                **meta[ref["id"]],
            },
            "sites": [
                {
                    **{k: s.get(k) for k in ("id", "name", "country", "lat", "lon", "role", "pair", "context", "source")},
                    "indicators": {k: results["primary"][s["id"]][k] for k in IND},
                    "valid_fraction": results["primary"][s["id"]]["valid_fraction"],
                    "elev_range": results["primary"][s["id"]]["elev_range"],
                    "excluded": s["id"] in excluded,
                    **meta[s["id"]],
                }
                for s in sites
            ],
            "configs": [
                {**c, "reference": {k: results[c["id"]][ref["id"]][k] for k in IND},
                 "sites": {i: {k: results[c["id"]][i][k] for k in IND} for i in ids}}
                for c in CONFIGS
            ],
        }

        validation_doc = {
            "version": 1,
            "generated_at": now,
            "target": ref["id"],
            "method": "robust-z gaussian similarity, weighted mean",
            "pool": ids,
            "excluded": excluded,
            "scaling": {"centre": dict(zip(IND, prim["centre"].tolist())), "scale": dict(zip(IND, prim["scale"].tolist()))},
            "equal_weights": {
                "scores": {i: float(prim["scores"][k]) for k, i in enumerate(ids)},
                "per_indicator": {i: dict(zip(IND, prim["sims"][k].tolist())) for k, i in enumerate(ids)},
                "ranks": {i: prim["ranks"][k] for k, i in enumerate(ids)},
            },
            "retrieval": {
                "pair": ref["pair"],
                "positives": f"Earth sites NASA's Planetary Analog Explorer pairs with the {ref['pair']}",
                "negatives": "negative controls",
                "auc_documented": retrieval(prim["scores"], is_pair_doc),
                "auc_all_documented": retrieval(prim["scores"], is_doc),
                "n_positive": sum(1 for i in ids if is_pair_doc(i)),
                "n_negative": sum(1 for i in ids if roles[i] == "control"),
                "top5": top5,
                "documented_in_top5": sum(1 for i in top5 if is_doc(i)),
                "controls_in_top5": sum(1 for i in top5 if roles[i] == "control"),
                "mean_rank": {
                    "documented_pair": float(np.mean([prim["ranks"][k] for k, i in enumerate(ids) if is_pair_doc(i)])),
                    "documented_all": float(np.mean([prim["ranks"][k] for k, i in enumerate(ids) if is_doc(i)])),
                    "control": float(np.mean([prim["ranks"][k] for k, i in enumerate(ids) if roles[i] == "control"])),
                },
            },
            "weight_perturbation": {
                "n": N_PERTURB, "seed": SEED, "distribution": "Dirichlet(1,1,1,1,1)",
                "rank_range": {
                    i: {"p5": int(np.percentile(rank_samples[:, k], 5)), "p50": int(np.percentile(rank_samples[:, k], 50)),
                        "p95": int(np.percentile(rank_samples[:, k], 95)), "min": int(rank_samples[:, k].min()), "max": int(rank_samples[:, k].max())}
                    for k, i in enumerate(ids)
                },
                "auc_documented": {"p5": float(np.percentile(auc_samples, 5)), "p50": float(np.percentile(auc_samples, 50)),
                                   "p95": float(np.percentile(auc_samples, 95))},
            },
            "sensitivity": configs_out,
            "correlation": {"order": IND, "matrix": np.corrcoef(prim["pool"].T).round(4).tolist()},
        }
        (OUT / f"indicators.{ref['id']}.v1.json").write_text(json.dumps(indicators_doc, indent=1, ensure_ascii=False), encoding="utf-8")
        (OUT / f"validation.{ref['id']}.v1.json").write_text(json.dumps(validation_doc, indent=1, ensure_ascii=False), encoding="utf-8")
        targets_index.append({k: ref[k] for k in ("id", "name", "short", "body", "pair", "lat", "lon", "note")} | {
            "quicklooks": meta[ref["id"]]["quicklooks"],
            "indicators": {k: results["primary"][ref["id"]][k] for k in IND},
            "auc_documented": validation_doc["retrieval"]["auc_documented"],
            "top": [{"id": i, "score": float(prim["scores"][ids.index(i)])} for i in top5],
        })

        r = validation_doc["retrieval"]
        print(f"\n== {ref['id']}  AUC({ref['pair']}-documented vs controls) {r['auc_documented']:.3f}  all documented {r['auc_all_documented']:.3f}")
        print("   perturbed AUC p5/p50/p95:", {k: round(v, 3) for k, v in validation_doc["weight_perturbation"]["auc_documented"].items()})
        for c in configs_out:
            print(f"   {c['id']:<15} AUC {c['auc_documented']:.3f}  spearman {c['spearman_vs_primary']:.3f}")
        for k in order:
            i = ids[k]
            print(f"   {prim['ranks'][k]:>2} {i:<18} {roles[i]:<10} {pairs[i] or '':<5} {prim['scores'][k]:.3f}")

    (OUT / "targets.v1.json").write_text(json.dumps({"version": 1, "generated_at": now, "targets": targets_index}, indent=1, ensure_ascii=False), encoding="utf-8")

    provenance_doc = {
        "version": 1,
        "generated_at": now,
        "datasets": DATASETS,
        "processing": [
            "Earth: GLO-30 tiles covering each window are warped with area averaging to a local azimuthal-equidistant grid (WGS84) centred on the site.",
            "Mars: the CTX DTM is resampled with area averaging in its own equirectangular CRS, using a 1/cos(latitude) east-west pixel so cells are square on the ground.",
            "Moon: the LOLA south-pole DEM is resampled with area averaging in its own polar stereographic CRS, with pixels enlarged by the projection scale factor k = 2/(1+sin|latitude|) so cells are 100 m on the ground.",
            "Primary grid: 200 x 200 cells of 100 m (20 km window). Sensitivity grids: 20 km at 200 m and 12 km at 100 m.",
            "Edge cells without a complete neighbourhood are excluded from every statistic.",
            f"Windows with less than {int(MIN_VALID * 100)}% valid elevation cells are excluded from scoring.",
        ],
        "sites": {s["id"]: {"tiles": meta[s["id"]]["dem"].get("tiles", []), "valid_fraction": results["primary"][s["id"]]["valid_fraction"]} for s in sites},
        "software": {"python": platform.python_version(), "numpy": np.__version__, "scipy": scipy.__version__,
                     "rasterio": rasterio.__version__, "gdal": rasterio.__gdal_version__},
    }
    (OUT / "provenance.v1.json").write_text(json.dumps(provenance_doc, indent=1, ensure_ascii=False), encoding="utf-8")


DATASETS = [
    {
        "id": "ctx-jezero-dtm",
        "name": "Mars 2020 Terrain Relative Navigation CTX DTM Mosaic (Jezero)",
        "provider": "USGS Astrogeology Science Center",
        "body": "Mars",
        "role": "Reference elevation (scored)",
        "resolution": "20 m/pixel, equirectangular, Mars 2000 sphere (R = 3,396,190 m)",
        "coverage": "18.21–18.72°N, 77.16–77.70°E",
        "url": "https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_ctx_dtm_mosaic",
        "doi": "https://doi.org/10.5066/P906QQT8",
        "licence": "No access constraints; please cite authors (Fergason et al., 2020)",
        "citation": "Fergason, R. L., et al. (2020). Mars 2020 Terrain Relative Navigation Flight Product Generation. 51st LPSC, abstract 2020.",
        "quality": "Vertical registration between CTX DTMs 3.8 m; aligned to HRSC; manually edited for erroneous posts.",
    },
    {
        "id": "lola-sp-20m",
        "name": "LOLA south-pole DEM mosaic, 20 m/pixel (LDEM_80S_20MPP_ADJ)",
        "provider": "NASA Goddard Planetary Geodesy Data Archive (PGDA product 90)",
        "body": "Moon",
        "role": "Reference elevation (scored)",
        "resolution": "20 m/pixel, polar stereographic, Moon (2015) sphere (R = 1,737,400 m)",
        "coverage": "80–90°S",
        "url": "https://pgda.gsfc.nasa.gov/products/90",
        "licence": "NASA open data",
        "quality": "Crossover-adjusted LOLA tracks; effective-resolution and error maps are published alongside the DEM.",
        "citation": "Barker, M. K. et al. (2021). Improved LOLA elevation maps for south pole landing sites. Planetary and Space Science 203, 105119.",
        "doi": "10.1016/j.pss.2020.105119",
    },
    {
        "id": "pgda-sun-visibility",
        "name": "Lunar polar average Sun visibility (AVGVISIB_75S_120M)",
        "provider": "NASA Goddard Planetary Geodesy Data Archive (PGDA product 69)",
        "body": "Moon",
        "role": "Context imagery only (not scored)",
        "resolution": "120 m/pixel, polar stereographic",
        "url": "https://pgda.gsfc.nasa.gov/products/69",
        "licence": "NASA open data",
        "citation": "Mazarico, E. et al. (2011). Illumination conditions of the lunar polar regions using LOLA topography. Icarus 211, 1066-1081.",
        "doi": "10.1016/j.icarus.2010.10.030",
    },
    {
        "id": "ctx-jezero-ortho",
        "name": "Mars 2020 TRN CTX orthomosaic (Jezero)",
        "provider": "USGS Astrogeology Science Center",
        "body": "Mars",
        "role": "Context imagery only (not scored)",
        "resolution": "6 m/pixel",
        "url": "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/index.html",
        "licence": "No access constraints; please cite authors",
    },
    {
        "id": "copernicus-glo30",
        "name": "Copernicus DEM GLO-30 (Digital Surface Model)",
        "provider": "European Space Agency / Copernicus, via AWS Open Data",
        "body": "Earth",
        "role": "Earth elevation (scored)",
        "resolution": "1 arc-second (~30 m); resampled by area averaging to the analysis grid",
        "coverage": "Global land",
        "url": "https://registry.opendata.aws/copernicus-dem/",
        "licence": "Free of charge for any use with attribution (Copernicus DEM licence)",
        "attribution": "Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.",
        "quality": "Surface model: includes vegetation and buildings; water bodies flattened.",
    },
    {
        "id": "s2-cloudless",
        "name": "Sentinel-2 cloudless mosaic",
        "provider": "EOX IT Services GmbH",
        "body": "Earth",
        "role": "Context imagery only (not scored)",
        "resolution": "~10 m source; shown as 400 px thumbnails",
        "url": "https://s2maps.eu",
        "licence": "CC BY-NC-SA 4.0",
        "attribution": "Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data)",
    },
    {
        "id": "nasa-analog-explorer",
        "name": "NASA Planetary Analog Explorer",
        "provider": "NASA Science",
        "body": "Earth",
        "role": "Validation labels (documented analog sites)",
        "url": "https://science.nasa.gov/solar-system/analog-explorer/",
        "licence": "Public NASA web content",
    },
    {
        "id": "artemis-regions",
        "name": "Artemis III candidate landing sites (Table A1)",
        "provider": "Wueller et al. (2026), JGR Planets",
        "body": "Moon",
        "role": "Target definition (window centre)",
        "url": "https://doi.org/10.1029/2025JE009434",
        "licence": "Published article",
        "doi": "10.1029/2025JE009434",
    },
]


if __name__ == "__main__":
    main()

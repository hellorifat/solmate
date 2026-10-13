# SolMate analysis pipeline

Computes terrain indicators for Jezero Crater (Mars), the Mons Mouton Plateau (lunar south pole) and Earth sites from real elevation models, then writes the static
artifacts that the frontend reads from `frontend/public/data/`.

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # (.venv/bin/pip on macOS/Linux)
.venv/Scripts/python -m pytest -q tests        # analytic checks of the terrain indicators
.venv/Scripts/python run.py                    # downloads DEM windows (cached in ./cache), writes JSON + quicklooks
.venv/Scripts/python screen.py                 # regional screening of ~250 Earth windows (run after run.py)
```

| File | Purpose |
|---|---|
| `sites.yaml` | Reference targets (one per body), documented analog sites (NASA Planetary Analog Explorer), other candidates and negative controls |
| `fetch.py` | Copernicus GLO-30 windows (AWS Open Data), the USGS Jezero CTX DTM and the LOLA south-pole DEM, resampled to a common metric grid |
| `terrain.py` | Slope, local relief, ruggedness (TRI) and hypsometric integral (pure functions) |
| `similarity.py` | Robust-z Gaussian similarity and weighted score (mirrored by `frontend/src/science/similarity.ts`) |
| `run.py` | Pipeline: per-target indicators for three analysis configurations, validation, weight perturbation, `targets.v1.json`, provenance |
| `screen.py` | Samples windows in 14 regions, scores them against every target with the curated pool's scaling, writes `screening.v1.json` |
| `sources/` | Verbatim source excerpts (with URL and retrieval date) behind each site's context claim |
| `claims_check.py` | Optional TypeSafe/Jev evidence check of context claims against `sources/` (needs `TYPESAFE_API_KEY`; `--offline` writes "not checked") |

No credentials are needed for the terrain pipeline; all inputs are public open data. The evidence check reads `TYPESAFE_API_KEY`
from the environment only, runs on the developer machine, and never affects scores.

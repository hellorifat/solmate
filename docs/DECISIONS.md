# Technology and data-source decision record

Prototype scope: two planetary targets (Jezero Crater on Mars and the Mons Mouton Plateau at the lunar south pole), real elevation data for every world, one transparent similarity method, one interactive map, and an unreviewed regional screening. Last updated 2026-10-12.

## Scientific scope

| Decision | Choice | Why |
|---|---|---|
| Target 1 | Jezero Crater landing region (Mars) | The app's existing default target and the subject of the team film. A 20 m CTX DTM is openly available, and NASA documents an Earth analog for it (Lake Salda). |
| Target 2 | Mons Mouton Plateau, lunar south pole (Moon) | One of NASA's Artemis III candidate landing regions, which matches the challenge's "permanent Moon base" framing. LOLA provides a 20 m polar DEM, and NASA's Analog Explorer pairs several Earth sites with the Moon, so the same validation applies. |
| Moon projection | Resample LOLA in its native polar stereographic grid, correcting cell size by the scale factor k = 2/(1 + sin\|lat\|) | Reprojecting to a local metric grid near the pole would add interpolation error; at 84.5°S the correction is under 0.1%. |
| Screening | 245 windows sampled on a 0.3° grid in 14 arid, volcanic and polar regions, scored with the curated pool's scaling | Shows the method can propose new places, not only rank a hand-picked list. Results are labelled unreviewed leads. Windows with < 90% valid cells or > 5% water are dropped. |
| Profile | Terrain morphometry at traverse scale | The research report lists DEM, slope and roughness as essential and recommends a transparent GIS baseline before any machine learning. |
| Window and grid | 20 × 20 km, 100 m cells | The CTX DTM covers about 32 × 30 km. 100 m means downsampling for both bodies, so no false detail. |
| Similarity | Robust-z Gaussian per indicator, weighted mean | Explainable, data-efficient, and decomposable into per-indicator contributions. |
| Validation | Retrieval of NASA Planetary Analog Explorer sites against negative controls (AUC), weight perturbation, scale sensitivity | Follows the report's validation protocol (known-site retrieval, negative controls, robustness). |
| Not scored | Mineralogy, climate, radiation, gravity | No comparable open raster for both bodies within scope. Shown as cited context only. |

## Data sources

| Source | Type | Access | Used for | Licence |
|---|---|---|---|---|
| USGS Mars 2020 TRN CTX DTM (Jezero) | Open dataset | Public HTTPS (USGS S3) | Mars elevation (scored) | No constraints; cite authors |
| USGS Mars 2020 TRN CTX orthomosaic | Open dataset | Public HTTPS | Mars context image | No constraints; cite authors |
| LOLA LDEM_80S_20MPP_ADJ (NASA GSFC PGDA) | Open dataset | Public HTTPS | Moon elevation (scored) | NASA open data; cite Barker et al. |
| PGDA average Sun visibility, 75°S, 120 m | Open dataset | Public HTTPS | Moon context image (not scored) | NASA open data; cite Mazarico et al. |
| Copernicus DEM GLO-30 | Open dataset | AWS Open Data COGs, no credentials | Earth elevation (scored) | Free with attribution |
| Sentinel-2 cloudless (EOX) | Free tile service | Public WMTS, CORS | Context imagery and map tiles | CC BY-NC-SA 4.0 |
| NASA GIBS Blue Marble | Free tile service | Public WMTS, CORS | Globe base map | Public domain |
| AWS Terrain Tiles (terrarium) | Open dataset | Public S3, CORS | Hillshade and 3D terrain | Open (Mapzen/AWS) |
| NASA Planetary Analog Explorer | Web catalogue | Public | Validation labels and context passages | NASA web content |
| OpenAlex | Open API | Public, no key | Abstracts for literature candidates | CC0 metadata |

**Considered and not used (yet)**

- **NASA PDS Search API.** Useful for discovering products, but the one product needed (the CTX DTM) has a stable direct URL.
- **Copernicus Data Space APIs.** These need registration. The same GLO-30 data is on AWS Open Data with no credentials.
- **ERA5-Land.** Needs a CDS account, and there is no comparable Mars climate raster in scope.
- **The live Django/Render API.** Its scores are hardcoded and latency-perturbed, so it is not a data source. It is left untouched.

## Software

| Need | Choice | Notes |
|---|---|---|
| Frontend | React 19, Vite 8, TypeScript 6, Tailwind CSS v4, shadcn/ui (Radix) | The team's preferred stack, replacing the single-page Next.js export. |
| Map | MapLibre GL JS 6 | Open source (BSD), globe projection, raster-dem terrain. No API key. |
| 3D hero | three.js via React Three Fiber and drei | Lazy-loaded after first paint (about 255 kB gzip), paused when off screen, poster fallback without WebGL. Textures are public-domain NASA/USGS mosaics. |
| Motion | Motion for React, Lenis | One animation system (scroll-driven effects use Motion `useScroll`). GSAP is not needed. Lenis smooths wheel scrolling on content pages only; the map workspace keeps native gestures. |
| Validation of artifacts | Zod | Malformed or stale JSON becomes a clear error state. |
| Pipeline | Python 3.11, rasterio/GDAL, numpy, scipy | Windowed COG reads and area-averaged resampling. |
| Tests | Vitest (TS, cross-checked against Python within 1e-9), pytest (analytic terrain checks) | |
| Backend | None for the prototype | Everything is static. There are no runtime secrets, so Firebase is deferred. |

## TypeSafe / Jev

- **Use case:** check that each site's context claim is supported by its stored source excerpt. One Choice question (supports / contradicts / says_nothing) per claim. Only `supports` at confidence ≥ 0.8 is marked supported; the rest go to human review.
- **Where it runs:** offline, at build time (`analysis/claims_check.py`), with `TYPESAFE_API_KEY` from the environment. The result is committed as `claims.v1.json`. No key is ever in the browser.
- **Effect:** the first run flagged 11 of 13 claims as saying more than their sources. Those claims were rewritten. The final run supports 12, and 1 is kept in human review.
- **Not used for:** screening, similarity scores, measurements, rankings or validation. Those stay deterministic.
- **Failure modes (tested):** no key, offline mode and API errors all produce "not checked".

## Security note for the team

`backend/solmate_core/settings.py` in the original repository contains a NASA API key, the Django `SECRET_KEY` and `DEBUG=True`. Rotate the NASA key, move both secrets to environment variables, and turn off `DEBUG` in production. This prototype does not modify the backend.

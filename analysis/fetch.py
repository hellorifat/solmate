"""Elevation windows on a common local metric grid.

Earth: Copernicus DEM GLO-30 Cloud-Optimized GeoTIFFs from the AWS Open Data registry
       (public HTTPS, no credentials), warped to a local azimuthal-equidistant grid.
Mars:  USGS Mars 2020 TRN CTX DTM mosaic of Jezero (20 m/px, equirectangular on the
       Mars 2000 sphere), resampled to the same physical cell size.

Downsampling uses area averaging so no detail finer than the source is invented.
"""
from __future__ import annotations

import math
import urllib.request
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import Affine
from rasterio.warp import Resampling, reproject

CACHE = Path(__file__).resolve().parent / "cache"
CACHE.mkdir(exist_ok=True)

GLO30_BASE = "https://copernicus-dem-30m.s3.amazonaws.com"
# planetarymaps.usgs.gov redirects to this USGS-hosted S3 bucket
CTX_JEZERO_URL = (
    "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/"
    "JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif"
)
MARS_RADIUS = 3396190.0

GDAL_ENV = dict(
    GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
    CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
    GDAL_HTTP_MAX_RETRY="4",
    GDAL_HTTP_RETRY_DELAY="2",
    VSI_CACHE="TRUE",
)


def glo30_tile_name(lat_floor: int, lon_floor: int) -> str:
    ns = "N" if lat_floor >= 0 else "S"
    ew = "E" if lon_floor >= 0 else "W"
    return f"Copernicus_DSM_COG_10_{ns}{abs(lat_floor):02d}_00_{ew}{abs(lon_floor):03d}_00_DEM"


def glo30_tiles_for(lat: float, lon: float, half_m: float) -> list[str]:
    dlat = half_m / 111_320 * 1.2
    dlon = dlat / max(math.cos(math.radians(lat)), 0.05)
    names = set()
    for la in range(math.floor(lat - dlat), math.floor(lat + dlat) + 1):
        for lo in range(math.floor(lon - dlon), math.floor(lon + dlon) + 1):
            names.add(glo30_tile_name(la, lo))
    return sorted(names)


def grid(size_m: float, cell: float) -> tuple[int, Affine]:
    n = int(round(size_m / cell))
    return n, Affine(cell, 0, -size_m / 2, 0, -cell, size_m / 2)


def earth_window(lat: float, lon: float, size_m: float, cell: float) -> tuple[np.ndarray, dict]:
    """Copernicus GLO-30 elevation (metres) on an n x n local AEQD grid centred on (lat, lon)."""
    key = CACHE / f"earth_{lat:.4f}_{lon:.4f}_{int(size_m)}_{int(cell)}.npy"
    tiles = glo30_tiles_for(lat, lon, size_m / 2)
    if key.exists():
        return np.load(key), {"tiles": tiles}
    n, transform = grid(size_m, cell)
    dst_crs = CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lon} +x_0=0 +y_0=0 +ellps=WGS84 +units=m +no_defs")
    out = np.full((n, n), np.nan, dtype=np.float32)
    used = []
    with rasterio.Env(**GDAL_ENV):
        for name in tiles:
            url = f"/vsicurl/{GLO30_BASE}/{name}/{name}.tif"
            try:
                src = rasterio.open(url)
            except rasterio.errors.RasterioIOError:
                continue  # no tile: open ocean
            with src:
                part = np.full((n, n), np.nan, dtype=np.float32)
                reproject(
                    source=rasterio.band(src, 1), destination=part,
                    src_transform=src.transform, src_crs=src.crs, src_nodata=src.nodata,
                    dst_transform=transform, dst_crs=dst_crs, dst_nodata=np.nan,
                    resampling=Resampling.average,
                )
                fill = np.isnan(out) & np.isfinite(part)
                out[fill] = part[fill]
                used.append(name)
    np.save(key, out)
    return out, {"tiles": used}


def ctx_jezero_path() -> Path:
    path = CACHE / Path(CTX_JEZERO_URL).name
    if not path.exists():
        req = urllib.request.Request(CTX_JEZERO_URL, headers={"User-Agent": "solmate-analysis/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def mars_window(lat: float, lon: float, size_m: float, cell: float) -> tuple[np.ndarray, dict]:
    """CTX DTM elevation (metres) on an n x n grid of `cell`-metre ground spacing centred on (lat, lon).

    The DTM is equirectangular with true scale at the equator, so one ground metre east-west
    spans 1/cos(lat) projected metres. Resampling in the source CRS with that anisotropic
    pixel avoids any cross-body coordinate transformation.
    """
    path = ctx_jezero_path()
    n, _ = grid(size_m, cell)
    with rasterio.open(path) as src:
        cx = MARS_RADIUS * math.radians(lon)
        cy = MARS_RADIUS * math.radians(lat)
        kx = 1.0 / math.cos(math.radians(lat))
        half = size_m / 2
        transform = Affine(cell * kx, 0, cx - half * kx, 0, -cell, cy + half)
        out = np.full((n, n), np.nan, dtype=np.float32)
        reproject(
            source=rasterio.band(src, 1), destination=out,
            src_transform=src.transform, src_crs=src.crs, src_nodata=src.nodata,
            dst_transform=transform, dst_crs=src.crs, dst_nodata=np.nan,
            resampling=Resampling.average,
        )
        meta = {"crs": src.crs.to_string(), "source_res_m": abs(src.transform.a), "file": path.name}
    return out, meta


CTX_ORTHO_URL = (
    "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/"
    "JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.tif"
)


def mars_ortho_window(lat: float, lon: float, size_m: float, cell: float) -> np.ndarray:
    """CTX orthomosaic (grayscale reflectance DN) on the same ground grid as `mars_window`, for imagery only."""
    path = CACHE / Path(CTX_ORTHO_URL).name
    if not path.exists():
        req = urllib.request.Request(CTX_ORTHO_URL, headers={"User-Agent": "solmate-analysis/1.0"})
        with urllib.request.urlopen(req, timeout=300) as r, open(path, "wb") as f:
            f.write(r.read())
    n, _ = grid(size_m, cell)
    with rasterio.open(path) as src:
        cx, cy = MARS_RADIUS * math.radians(lon), MARS_RADIUS * math.radians(lat)
        kx = 1.0 / math.cos(math.radians(lat))
        half = size_m / 2
        transform = Affine(cell * kx, 0, cx - half * kx, 0, -cell, cy + half)
        out = np.full((n, n), np.nan, dtype=np.float32)
        reproject(
            source=rasterio.band(src, 1), destination=out,
            src_transform=src.transform, src_crs=src.crs, src_nodata=src.nodata or 0,
            dst_transform=transform, dst_crs=src.crs, dst_nodata=np.nan,
            resampling=Resampling.average,
        )
    return out


S2_TILES = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"


def s2_thumbnail(lat: float, lon: float, size_m: float, px: int = 640):
    """Sentinel-2 cloudless (EOX) true-colour image of the window, for context only. Returns a PIL image or None."""
    import io
    from PIL import Image

    key = CACHE / f"s2_{lat:.4f}_{lon:.4f}_{int(size_m)}.jpg"
    if key.exists():
        return Image.open(key)
    half = size_m / 2
    dlat = half / 111_320
    dlon = dlat / math.cos(math.radians(lat))
    z = 13 if abs(lat) < 60 else 12

    def tile_xy(la, lo):
        n = 2 ** z
        x = (lo + 180) / 360 * n
        y = (1 - math.asinh(math.tan(math.radians(la))) / math.pi) / 2 * n
        return x, y

    x0, y0 = tile_xy(lat + dlat, lon - dlon)
    x1, y1 = tile_xy(lat - dlat, lon + dlon)
    tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)
    mosaic = Image.new("RGB", ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    ok = 0
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            req = urllib.request.Request(S2_TILES.format(z=z, x=tx, y=ty), headers={"User-Agent": "solmate-analysis/1.0"})
            for attempt in range(4):
                try:
                    with urllib.request.urlopen(req, timeout=60) as r:
                        mosaic.paste(Image.open(io.BytesIO(r.read())).convert("RGB"), ((tx - tx0) * 256, (ty - ty0) * 256))
                        ok += 1
                        break
                except Exception:
                    import time
                    time.sleep(2 * (attempt + 1))
    expected = (tx1 - tx0 + 1) * (ty1 - ty0 + 1)
    if ok < expected:
        return None  # incomplete mosaic: show no imagery rather than a patched one
    box = (int((x0 - tx0) * 256), int((y0 - ty0) * 256), int((x1 - tx0) * 256), int((y1 - ty0) * 256))
    img = mosaic.crop(box).resize((px, px), Image.LANCZOS)
    img.save(key, quality=92)
    return img


# ---------------------------------------------------------------- Moon (south pole)
LOLA_SP_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF"
SUN_VIS_URL = "https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608.TIF"
MOON_ENV = dict(GDAL_ENV, GDAL_HTTP_UNSAFESSL="YES")  # pgda.gsfc.nasa.gov certificate revocation checks fail on some networks


def _polar_window(url: str, lat: float, lon: float, size_m: float, cell: float, resampling) -> tuple[np.ndarray, dict]:
    """Resample a south-polar-stereographic lunar raster onto an n x n grid of `cell`-metre ground spacing.

    Works in the raster's own CRS (no cross-body transformation). Polar stereographic with true scale
    at the pole stretches distances by k = 2 / (1 + sin|lat|), so projected pixels are k * cell wide.
    """
    from pyproj import CRS, Transformer

    n, _ = grid(size_m, cell)
    with rasterio.Env(**MOON_ENV), rasterio.open(f"/vsicurl/{url}") as src:
        crs = CRS.from_wkt(src.crs.to_wkt())
        cx, cy = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True).transform(lon, lat)
        k = 2.0 / (1.0 + math.sin(math.radians(abs(lat))))
        half = size_m / 2 * k
        transform = Affine(cell * k, 0, cx - half, 0, -cell * k, cy + half)
        out = np.full((n, n), np.nan, dtype=np.float32)
        reproject(
            source=rasterio.band(src, 1), destination=out,
            src_transform=src.transform, src_crs=src.crs, src_nodata=src.nodata,
            dst_transform=transform, dst_crs=src.crs, dst_nodata=np.nan,
            resampling=resampling,
        )
        meta = {"crs": crs.name, "source_res_m": abs(src.transform.a), "scale_factor_k": k, "file": url.rsplit("/", 1)[-1]}
    return out, meta


def moon_window(lat: float, lon: float, size_m: float, cell: float) -> tuple[np.ndarray, dict]:
    """LOLA 20 m south-pole DEM (PGDA product 90) on the common ground grid; cached."""
    key = CACHE / f"moon_{lat:.4f}_{lon:.4f}_{int(size_m)}_{int(cell)}.npy"
    meta_key = key.with_suffix(".json")
    if key.exists() and meta_key.exists():
        import json
        return np.load(key), json.loads(meta_key.read_text())
    out, meta = _polar_window(LOLA_SP_URL, lat, lon, size_m, cell, Resampling.average)
    import json
    np.save(key, out)
    meta_key.write_text(json.dumps(meta))
    return out, meta


def moon_sun_visibility(lat: float, lon: float, size_m: float):
    """Average Sun visibility (fraction of time, PGDA lunar polar illumination, 120 m) as a context image."""
    out, _ = _polar_window(SUN_VIS_URL, lat, lon, size_m, 50, Resampling.bilinear)
    return out

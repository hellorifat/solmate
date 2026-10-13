import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { SiteResult } from '@/science/analysis'
import type { Layer } from '@/hooks/useExplorerState'
import { ROLE } from './roles'

// MapLibre locates its worker next to its own module, which Vite relocates; point it at the emitted file instead.
maplibregl.setWorkerUrl(workerUrl)

const HALF_WINDOW_M = 10_000

// Public, keyless tile services (CORS-enabled):
//  - NASA GIBS Blue Marble shaded relief + bathymetry (public domain) for the globe view
//  - Sentinel-2 cloudless by EOX (CC BY-NC-SA 4.0) for regional imagery
//  - AWS Terrain Tiles (terrarium encoding) for hillshade and 3D terrain
const STYLE: StyleSpecification = {
  version: 8,
  projection: { type: 'globe' },
  sky: {
    'sky-color': '#05080d',
    'horizon-color': '#1b3554',
    'fog-color': '#0a1019',
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 6, 0.4, 9, 0],
  },
  sources: {
    bluemarble: {
      type: 'raster',
      tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'],
      tileSize: 256,
      maxzoom: 8,
      attribution: 'Blue Marble: NASA Earth Observatory / GIBS',
    },
    s2: {
      type: 'raster',
      tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'],
      tileSize: 256,
      maxzoom: 14,
      attribution: '<a href="https://s2maps.eu" target="_blank" rel="noreferrer">Sentinel-2 cloudless</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data)',
    },
    terrain: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 14,
      encoding: 'terrarium',
      attribution: 'Terrain Tiles: Mapzen / AWS Open Data',
    },
    windows: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    screened: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#05080d' } },
    { id: 'bluemarble', type: 'raster', source: 'bluemarble', paint: { 'raster-saturation': -0.15, 'raster-brightness-max': 0.92 } },
    {
      id: 's2',
      type: 'raster',
      source: 's2',
      minzoom: 4,
      paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0, 6, 1], 'raster-saturation': -0.1, 'raster-contrast': 0.05 },
    },
    {
      id: 'hillshade',
      type: 'hillshade',
      source: 'terrain',
      layout: { visibility: 'none' },
      paint: {
        'hillshade-shadow-color': '#05080d',
        'hillshade-highlight-color': '#e8edf3',
        'hillshade-accent-color': '#3b4a60',
        'hillshade-exaggeration': 0.6,
      },
    },
    {
      id: 'window-fill',
      type: 'fill',
      source: 'windows',
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['get', 'selected'], 0.04, 0.0] },
    },
    {
      id: 'window-line',
      type: 'line',
      source: 'windows',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['get', 'selected'], 2, 1],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0, 6, 0.9],
        'line-dasharray': [3, 2],
      },
    },
    {
      id: 'screened-halo',
      type: 'circle',
      source: 'screened',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['*', 6, ['get', 'score']], 6, ['*', 16, ['get', 'score']], 10, ['*', 30, ['get', 'score']]],
        'circle-color': '#e7a1c9',
        'circle-opacity': ['*', 0.18, ['get', 'score']],
        'circle-blur': 0.6,
      },
    },
    {
      id: 'screened',
      type: 'circle',
      source: 'screened',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2.5, 6, 5, 10, 8],
        'circle-color': ['interpolate', ['linear'], ['get', 'score'], 0, '#2c3d56', 0.5, '#7d6a8e', 0.8, '#e7a1c9', 1, '#fff2fa'],
        'circle-stroke-color': '#05080d',
        'circle-stroke-width': ['case', ['get', 'selected'], 2.5, 1],
        'circle-opacity': 0.95,
      },
    },
  ],
}

function cssColor(v: string): string {
  // resolve CSS custom properties for MapLibre paint values
  const name = v.match(/var\((--[^)]+)\)/)?.[1]
  return name ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#7fd8e6' : v
}

function windowPolygon(lat: number, lon: number): { type: 'Polygon'; coordinates: number[][][] } {
  const dLat = HALF_WINDOW_M / 111_320
  const dLon = dLat / Math.cos((lat * Math.PI) / 180)
  return {
    type: 'Polygon',
    coordinates: [[[lon - dLon, lat - dLat], [lon + dLon, lat - dLat], [lon + dLon, lat + dLat], [lon - dLon, lat + dLat], [lon - dLon, lat - dLat]]],
  }
}

interface Props {
  results: SiteResult[]
  screened: SiteResult[]
  showScreened: boolean
  selectedId: string | null
  hoveredId: string | null
  layer: Layer
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  reducedMotion: boolean
  /** screen space covered by floating panels, so the camera centres in the visible part of the map */
  padding: { left: number; right: number; top: number; bottom: number }
}

export function MapView({ results, screened, showScreened, selectedId, hoveredId, layer, onSelect, onHover, reducedMotion, padding }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLButtonElement }>())
  const ready = useRef(false)
  const pending = useRef<((m: maplibregl.Map) => void)[]>([])
  const whenReady = (fn: (m: maplibregl.Map) => void) => {
    if (ready.current && map.current) fn(map.current)
    else pending.current.push(fn)
  }
  const layerInitialised = useRef(false)
  const [loaded, setLoaded] = useState(false)
  const handlers = useRef({ onSelect, onHover })
  handlers.current = { onSelect, onHover }

  // create the map once
  useEffect(() => {
    if (!container.current) return
    const m = new maplibregl.Map({
      container: container.current,
      style: STYLE,
      center: [-60, 28],
      zoom: 1.9,
      attributionControl: { compact: true },
      maxPitch: 70,
    })
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
    m.on('click', 'screened', (e) => {
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') handlers.current.onSelect(id)
    })
    m.on('mouseenter', 'screened', () => (m.getCanvas().style.cursor = 'pointer'))
    m.on('mouseleave', 'screened', () => (m.getCanvas().style.cursor = ''))
    m.once('style.load', () => {
      ready.current = true
      setLoaded(true)
      const queue = pending.current.splice(0)
      queue.forEach((fn) => fn(m))
    })
    map.current = m
    const store = markers.current
    return () => {
      store.forEach(({ marker }) => marker.remove())
      store.clear()
      m.remove()
      map.current = null
      ready.current = false
      pending.current = []
    }
  }, [])

  // markers and analysis windows follow the current ranking
  useEffect(() => {
    const apply = (m: maplibregl.Map) => {
      const seen = new Set<string>()
      for (const r of results) {
        seen.add(r.site.id)
        let entry = markers.current.get(r.site.id)
        if (!entry) {
          const el = document.createElement('button')
          el.type = 'button'
          el.className = 'solmate-marker'
          el.appendChild(document.createElement('span'))
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            handlers.current.onSelect(r.site.id)
          })
          el.addEventListener('mouseenter', () => handlers.current.onHover(r.site.id))
          el.addEventListener('mouseleave', () => handlers.current.onHover(null))
          const marker = new maplibregl.Marker({ element: el }).setLngLat([r.site.lon, r.site.lat]).addTo(m)
          entry = { marker, el }
          markers.current.set(r.site.id, entry)
        }
        const { el } = entry
        el.firstElementChild!.textContent = String(r.rank)
        el.style.setProperty('--marker-color', ROLE[r.site.role].color)
        el.setAttribute('aria-label', `${r.site.name}, rank ${r.rank}, similarity ${Math.round(r.score * 100)}`)
        el.dataset.role = r.site.role
      }
      markers.current.forEach((v, id) => {
        if (!seen.has(id)) {
          v.marker.remove()
          markers.current.delete(id)
        }
      })
      const selScreen = screened.find((r) => r.site.id === selectedId)
      const src = m.getSource('windows') as GeoJSONSource | undefined
      src?.setData({
        type: 'FeatureCollection',
        features: [...results, ...(selScreen ? [selScreen] : [])].map((r) => ({
          type: 'Feature',
          properties: { id: r.site.id, color: cssColor(ROLE[r.site.role].color), selected: r.site.id === selectedId },
          geometry: windowPolygon(r.site.lat, r.site.lon),
        })),
      })
    }
    whenReady(apply)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, screened, selectedId])

  // screening layer: one point per screened window, coloured by similarity
  useEffect(() => {
    whenReady((m) => {
      const src = m.getSource('screened') as GeoJSONSource | undefined
      src?.setData({
        type: 'FeatureCollection',
        features: screened.map((r) => ({
          type: 'Feature',
          properties: { id: r.site.id, score: r.score, selected: r.site.id === selectedId },
          geometry: { type: 'Point', coordinates: [r.site.lon, r.site.lat] },
        })),
      })
      for (const id of ['screened', 'screened-halo']) m.setLayoutProperty(id, 'visibility', showScreened ? 'visible' : 'none')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screened, showScreened, selectedId])

  // selection and hover styling
  useEffect(() => {
    markers.current.forEach(({ el }, id) => {
      el.dataset.selected = String(id === selectedId)
      el.dataset.hovered = String(id === hoveredId)
    })
  }, [selectedId, hoveredId, results])

  // camera follows the selected site
  useEffect(() => {
    const target = results.find((r) => r.site.id === selectedId) ?? screened.find((r) => r.site.id === selectedId)
    const go = (m: maplibregl.Map) => {
      if (target) {
        const opts = { center: [target.site.lon, target.site.lat] as [number, number], zoom: 10.3, pitch: layer === 'terrain' ? 55 : 0, bearing: layer === 'terrain' ? -20 : 0, padding }
        if (reducedMotion) m.jumpTo(opts)
        else m.flyTo({ ...opts, duration: 2600, curve: 1.5, essential: true })
      } else {
        const opts = { center: [-60, 28] as [number, number], zoom: 1.9, pitch: 0, bearing: 0, padding }
        if (reducedMotion) m.jumpTo(opts)
        else m.flyTo({ ...opts, duration: 1800, essential: true })
      }
    }
    whenReady(go)
    // results identity changes with weights; only react to the selected id and layer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, reducedMotion])

  // layer mode: imagery vs terrain (hillshade + 3D)
  useEffect(() => {
    const apply = (m: maplibregl.Map) => {
      const terrain = layer === 'terrain'
      m.setLayoutProperty('hillshade', 'visibility', terrain ? 'visible' : 'none')
      m.setPaintProperty('s2', 'raster-saturation', terrain ? -0.85 : -0.1)
      m.setPaintProperty('s2', 'raster-brightness-max', terrain ? 0.55 : 1)
      // enabling terrain mid-flight cancels the camera animation, so wait for any flight to finish
      const setTerrain = () => m.setTerrain(terrain ? { source: 'terrain', exaggeration: 1.4 } : null)
      if (m.isMoving()) m.once('moveend', setTerrain)
      else setTerrain()
      // the first application happens at load; the camera effect already sets pitch, so don't interrupt its flight
      if (layerInitialised.current && selectedId) m.easeTo({ pitch: terrain ? 55 : 0, bearing: terrain ? -20 : 0, duration: reducedMotion ? 0 : 900 })
      layerInitialised.current = true
    }
    whenReady(apply)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer])

  // maplibre-gl.css forces position:relative on the container, so size it inside an absolutely positioned wrapper
  return (
    <div className="absolute inset-0" role="region" aria-label="Map of Earth candidate sites" aria-busy={!loaded}>
      <div ref={container} className={`h-full w-full transition-opacity duration-1000 ${loaded ? 'opacity-100' : 'opacity-0'}`} />
      {!loaded && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="label-mono animate-pulse">Loading globe</span>
        </div>
      )}
    </div>
  )
}

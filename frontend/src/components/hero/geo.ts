import { Vector3 } from 'three'

const D2R = Math.PI / 180

/**
 * Latitude/longitude to a point on a sphere, matching three.js SphereGeometry UVs for an
 * equirectangular texture that spans -180..180° longitude, left to right.
 */
export function latLonToVec3(lat: number, lon: number, r = 1, out = new Vector3()): Vector3 {
  const phi = (90 - lat) * D2R
  const theta = (lon + 180) * D2R
  return out.set(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta))
}

/** Euler angles (XYZ order) that turn a surface point to face +Z, the camera direction. */
export function faceCamera(lat: number, lon: number, tilt = 1): { x: number; y: number } {
  const p = latLonToVec3(lat, lon)
  return { x: Math.asin(p.y) * tilt, y: -Math.atan2(p.x, p.z) }
}

/** Mean direction of several surface points, as lat/lon (a fair "centre" for sites spread across a hemisphere). */
export function centroid(points: { lat: number; lon: number }[]): { lat: number; lon: number } {
  const v = new Vector3()
  const tmp = new Vector3()
  for (const p of points) v.add(latLonToVec3(p.lat, p.lon, 1, tmp))
  if (v.lengthSq() === 0) return { lat: 0, lon: 0 }
  v.normalize()
  const lat = Math.asin(v.y) / D2R
  // invert latLonToVec3: x = -cos(lat)cos(theta), z = cos(lat)sin(theta)
  const theta = Math.atan2(v.z, -v.x)
  let lon = theta / D2R - 180
  if (lon < -180) lon += 360
  return { lat, lon }
}

/** Shortest signed angle from a to b. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export function fmtValue(v: number, unit: string): string {
  if (!Number.isFinite(v)) return '–'
  if (unit === '°') return `${v.toFixed(1)}°`
  if (unit === 'm') return `${v < 10 ? v.toFixed(1) : Math.round(v)} m`
  return v.toFixed(2)
}

export const pct = (v: number) => `${Math.round(v * 100)}`

export function fmtCoord(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

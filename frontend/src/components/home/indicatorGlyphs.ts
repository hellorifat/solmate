// Plain-language reading of each indicator, plus a tiny cross-section sketch of what it measures.
export const PLAIN: Record<string, { hint: string; path: string }> = {
  slope_median: { hint: 'How tilted the typical ground is.', path: 'M2 30 L20 24 L38 18 L56 12 L74 6' },
  slope_p90: { hint: 'How much of the area is steep: crater walls, scarps, cones.', path: 'M2 30 L22 30 L30 6 L42 6 L50 30 L74 30' },
  local_relief: { hint: 'Height difference you meet within 1 km.', path: 'M2 28 L12 10 L22 28 L32 10 L42 28 L52 10 L62 28 L72 10' },
  ruggedness: { hint: 'How bumpy the surface is cell to cell.', path: 'M2 22 L8 16 L12 24 L18 14 L24 22 L30 12 L36 24 L42 16 L48 22 L54 14 L60 24 L66 16 L74 20' },
  hypsometric_integral: { hint: 'Where the land sits between its lowest and highest point: basin vs plateau.', path: 'M2 30 C20 30 24 8 38 8 C52 8 56 30 74 30' },
}

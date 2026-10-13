import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

export type Layer = 'imagery' | 'terrain'

/**
 * Explorer state lives in the URL so any view (selected site, weights, map layer) can be shared or bookmarked.
 *   ?site=lava-beds&w=1,1,0.5,1,1&layer=terrain
 */
export function useExplorerState(indicatorIds: readonly string[]) {
  const [params, setParams] = useSearchParams()

  const weights = useMemo(() => {
    const raw = params.get('w')?.split(',').map(Number) ?? []
    return Object.fromEntries(
      indicatorIds.map((id, i) => {
        const v = raw[i]
        return [id, Number.isFinite(v) && v! >= 0 && v! <= 1 ? v! : 1]
      }),
    ) as Record<string, number>
  }, [params, indicatorIds])

  const selected = params.get('site')
  const layer: Layer = params.get('layer') === 'terrain' ? 'terrain' : 'imagery'
  const target = params.get('target') ?? 'jezero'
  const tab: 'curated' | 'screened' = params.get('tab') === 'screened' ? 'screened' : 'curated'
  const showScreening = params.get('scr') === '1' || tab === 'screened'
  const compare = useMemo(() => (params.get('cmp') ?? '').split(',').filter(Boolean).slice(0, 2), [params])

  const update = useCallback(
    (patch: Record<string, string | null>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v === null) next.delete(k)
            else next.set(k, v)
          }
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  const setWeight = useCallback(
    (id: string, value: number) => {
      const w = indicatorIds.map((k) => (k === id ? value : weights[k]!))
      update({ w: w.every((x) => x === 1) ? null : w.map((x) => +x.toFixed(2)).join(',') })
    },
    [indicatorIds, weights, update],
  )

  const toggleCompare = (id: string) => {
    const next = compare.includes(id) ? compare.filter((c) => c !== id) : [...compare, id].slice(-2)
    update({ cmp: next.length ? next.join(',') : null })
  }

  return {
    weights,
    selected,
    layer,
    target,
    tab,
    showScreening,
    compare,
    setTarget: (t: string) => update({ target: t === 'jezero' ? null : t, site: null, cmp: null }),
    setTab: (t: 'curated' | 'screened') => update({ tab: t === 'curated' ? null : t }),
    setShowScreening: (on: boolean) => update({ scr: on ? '1' : null }),
    toggleCompare,
    clearCompare: () => update({ cmp: null }),
    isDefaultWeights: indicatorIds.every((k) => weights[k] === 1),
    select: (id: string | null) => update({ site: id }),
    setLayer: (l: Layer) => update({ layer: l === 'imagery' ? null : l }),
    setWeight,
    resetWeights: () => update({ w: null }),
    setAllWeights: (w: Record<string, number>) => {
      const v = indicatorIds.map((k) => w[k] ?? 1)
      update({ w: v.every((x) => x === 1) ? null : v.map((x) => +x.toFixed(2)).join(',') })
    },
  }
}

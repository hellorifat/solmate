import { useEffect, useState } from 'react'
import { loadCommon, loadTarget, type CommonData, type TargetData } from '@/data/load'
import { analyse, equalWeights, type AnalysisResult } from '@/science/analysis'

export interface TargetBundle extends TargetData {
  analysis: AnalysisResult // equal weights, including screened windows
}

export interface AllTargets {
  common: CommonData
  byId: Record<string, TargetBundle>
}

/** Common artifacts plus every target analysed at equal weights (for overview pages). */
export function useAllTargets() {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: AllTargets }>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    loadCommon()
      .then(async (common) => {
        const entries = await Promise.all(
          common.targets.targets.map(async (t) => {
            const d = await loadTarget(t.id)
            return [t.id, { ...d, analysis: analyse(d.indicators, equalWeights(d.indicators.profile.scored), common.screening) }] as const
          }),
        )
        if (alive) setState({ status: 'ready', data: { common, byId: Object.fromEntries(entries) } })
      })
      .catch((error: Error) => alive && setState({ status: 'error', error }))
    return () => {
      alive = false
    }
  }, [])
  return state
}

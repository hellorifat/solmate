import { useCallback, useEffect, useState } from 'react'
import { loadAnalysisData, loadCommon, type AnalysisData, type CommonData } from '@/data/load'

type State<T> = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: T }

function useLoader<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = useState<State<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    load()
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch((error: Error) => alive && setState({ status: 'error', error }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])
  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((a) => a + 1)
  }, [])
  return { ...state, retry }
}

/** Everything needed to analyse one target (keeps the previous data visible while a new target loads). */
export function useAnalysisData(targetId: string = 'jezero') {
  return useLoader<AnalysisData>(() => loadAnalysisData(targetId), targetId)
}

export function useCommonData() {
  return useLoader<CommonData>(loadCommon, 'common')
}

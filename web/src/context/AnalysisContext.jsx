import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAnalysisResult, listAnalyses, supabaseConfigured } from '../lib/supabase.js'
import { SAMPLE_ID, sampleResult } from '../sample/sampleResult.js'

const AnalysisContext = createContext(null)

export const sampleEnabled = import.meta.env.DEV

function readIdFromUrl() {
  return new URLSearchParams(window.location.search).get('analysis')
}

function writeIdToUrl(id) {
  const url = new URL(window.location.href)
  if (id) url.searchParams.set('analysis', id)
  else url.searchParams.delete('analysis')
  window.history.replaceState(null, '', url)
}

/**
 * 공통 분석 상태.
 * - 목록: Supabase analyses (id, created_at)
 * - 선택한 분석의 result: Supabase에서 읽거나, API 완료 결과를 provideResult로 직접 넣는다.
 * 모든 화면은 { analysisId, result, loading, error }를 같은 값으로 받는다.
 */
export function AnalysisProvider({ children }) {
  const cache = useRef(new Map(sampleEnabled ? [[SAMPLE_ID, sampleResult]] : []))
  const [list, setList] = useState({ items: [], loading: supabaseConfigured, error: null })
  const [selectedId, setSelectedId] = useState(readIdFromUrl)
  const [current, setCurrent] = useState({ id: null, result: null, loading: false, error: null })

  const refreshList = useCallback(async () => {
    if (!supabaseConfigured) return
    setList((prev) => ({ ...prev, loading: true, error: null }))
    try {
      setList({ items: await listAnalyses(), loading: false, error: null })
    } catch (error) {
      setList((prev) => ({ ...prev, loading: false, error: error.message }))
    }
  }, [])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  useEffect(() => {
    writeIdToUrl(selectedId)
    if (!selectedId) {
      setCurrent({ id: null, result: null, loading: false, error: null })
      return
    }
    if (cache.current.has(selectedId)) {
      setCurrent({ id: selectedId, result: cache.current.get(selectedId), loading: false, error: null })
      return
    }
    if (!supabaseConfigured) {
      setCurrent({ id: selectedId, result: null, loading: false, error: 'Supabase 환경변수가 없어 저장된 결과를 읽을 수 없습니다.' })
      return
    }
    let cancelled = false
    setCurrent({ id: selectedId, result: null, loading: true, error: null })
    fetchAnalysisResult(selectedId)
      .then((result) => {
        if (cancelled) return
        if (result) cache.current.set(selectedId, result)
        setCurrent({ id: selectedId, result, loading: false, error: null })
      })
      .catch((error) => {
        if (!cancelled) setCurrent({ id: selectedId, result: null, loading: false, error: error.message })
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const select = useCallback((id) => setSelectedId(id || null), [])

  /** API 등 외부에서 받은 결과를 등록하고 선택한다. */
  const provideResult = useCallback(
    (id, result) => {
      cache.current.set(id, result)
      setSelectedId(id)
      setCurrent({ id, result, loading: false, error: null })
      refreshList()
    },
    [refreshList],
  )

  const value = useMemo(
    () => ({
      supabaseConfigured,
      sampleEnabled,
      list,
      refreshList,
      selectedId,
      select,
      provideResult,
      // 화면 전달용 공통 props
      pageProps: {
        analysisId: current.id,
        result: current.result,
        loading: current.loading,
        error: current.error,
      },
    }),
    [list, refreshList, selectedId, select, provideResult, current],
  )

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
}

export function useAnalysis() {
  const value = useContext(AnalysisContext)
  if (!value) throw new Error('useAnalysis는 AnalysisProvider 안에서 사용해야 합니다.')
  return value
}

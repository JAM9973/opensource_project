import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAnalysis } from '../../context/AnalysisContext.jsx'
import { ApiError, createAnalysis, getAnalysis } from '../../lib/api.js'

const POLL_MS = 2000
const MAX_POLL_FAILURES = 5
const STORAGE_KEY = 'analysis-job-id'

const JobContext = createContext(null)

const idle = { id: null, status: 'idle', processed: 0, total: 0, error: null, storageNote: null }

/**
 * 분석 요청과 진행 상태 조회. 탭을 바꿔도 조회가 계속되도록 앱 전체에서 한 번만 둔다.
 * 새로고침 시 sessionStorage의 id로 조회를 이어간다.
 */
export function AnalysisJobProvider({ children }) {
  const { provideResult } = useAnalysis()
  const [job, setJob] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    return saved ? { ...idle, id: saved, status: 'queued' } : idle
  })
  const failures = useRef(0)

  const finish = useCallback((next) => {
    sessionStorage.removeItem(STORAGE_KEY)
    setJob(next)
  }, [])

  const start = useCallback(async (video, profileText) => {
    setJob({ ...idle, status: 'uploading' })
    try {
      const created = await createAnalysis(video, profileText)
      sessionStorage.setItem(STORAGE_KEY, created.id)
      failures.current = 0
      setJob({ ...idle, id: created.id, status: created.status ?? 'queued' })
    } catch (error) {
      setJob({ ...idle, status: 'failed', error: error.message })
    }
  }, [])

  const reset = useCallback(() => finish(idle), [finish])

  const polling = job.id && (job.status === 'queued' || job.status === 'processing')

  useEffect(() => {
    if (!polling) return
    let stopped = false
    let timer

    const tick = async () => {
      try {
        const data = await getAnalysis(job.id)
        if (stopped) return
        failures.current = 0
        if (data.status === 'completed') {
          provideResult(data.id ?? job.id, data.result)
          finish({ ...idle, id: job.id, status: 'completed', processed: data.processed_frames ?? 0, total: data.total_frames ?? 0, storageNote: data.storage_error ?? null })
          return
        }
        if (data.status === 'failed') {
          finish({ ...idle, id: job.id, status: 'failed', error: data.error ?? '분석에 실패했습니다.' })
          return
        }
        setJob((prev) => ({ ...prev, status: data.status, processed: data.processed_frames ?? prev.processed, total: data.total_frames ?? prev.total }))
      } catch (error) {
        if (stopped) return
        if (error instanceof ApiError && error.status === 404) {
          finish({ ...idle, id: job.id, status: 'failed', error: '분석을 찾을 수 없습니다. 서버가 재시작되면 진행 중이던 분석은 복구되지 않습니다.' })
          return
        }
        failures.current += 1
        if (failures.current >= MAX_POLL_FAILURES) {
          finish({ ...idle, id: job.id, status: 'failed', error: `진행 상태 조회 실패: ${error.message}` })
          return
        }
      }
      timer = setTimeout(tick, POLL_MS)
    }

    tick()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [polling, job.id, provideResult, finish])

  return <JobContext.Provider value={{ job, start, reset }}>{children}</JobContext.Provider>
}

export function useAnalysisJob() {
  const value = useContext(JobContext)
  if (!value) throw new Error('useAnalysisJob은 AnalysisJobProvider 안에서 사용해야 합니다.')
  return value
}

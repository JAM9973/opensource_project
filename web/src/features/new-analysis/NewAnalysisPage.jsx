import { useEffect, useRef, useState } from 'react'
import StatusMessage from '../../components/StatusMessage.jsx'
import { apiConfigured, inspectProfile } from '../../lib/api.js'
import { useAnalysisJob } from './AnalysisJobContext.jsx'

const STATUS_TEXT = { uploading: '영상 업로드 중', queued: '분석 대기 중', processing: '분석 중' }

export default function NewAnalysisPage({ onNavigate }) {
  const { job, start, reset } = useAnalysisJob()
  const [video, setVideo] = useState(null)
  const [profile, setProfile] = useState({ text: null, name: '', info: null, error: null })
  const prevStatus = useRef(job.status)

  // 이 화면에서 분석이 끝나면 시간대별 통계로 이동해 결과를 보여준다.
  useEffect(() => {
    if (prevStatus.current !== 'completed' && job.status === 'completed') onNavigate?.('time-series')
    prevStatus.current = job.status
  }, [job.status, onNavigate])

  const onProfile = async (file) => {
    if (!file) return setProfile({ text: null, name: '', info: null, error: null })
    try {
      const text = await file.text()
      setProfile({ text, name: file.name, info: inspectProfile(text), error: null })
    } catch (error) {
      setProfile({ text: null, name: file.name, info: null, error: error.message })
    }
  }

  const busy = ['uploading', 'queued', 'processing'].includes(job.status)
  const canSubmit = apiConfigured && video && profile.text && !busy

  const submit = (event) => {
    event.preventDefault()
    if (canSubmit) start(video, profile.text)
  }

  const percent = job.total > 0 ? Math.min(100, Math.round((job.processed / job.total) * 100)) : null

  return (
    <div className="section">
      <div className="section-head">
        <h2>새 분석 요청</h2>
        <span className="hint">배속 1 · 영상 재생시간 기준</span>
      </div>

      {!apiConfigured && <StatusMessage kind="error" title="분석 API 주소가 없습니다">VITE_MODEL_API_BASE_URL을 .env.local에 설정하세요.</StatusMessage>}

      <form className="form card" onSubmit={submit}>
        <label className="field">
          <span>영상</span>
          <input type="file" accept="video/*" disabled={busy} onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
          <small className="hint">200MB 이하. 서버는 한 번에 한 영상만 분석합니다.</small>
        </label>

        <label className="field">
          <span>영역 프로필 JSON</span>
          <input type="file" accept="application/json,.json" disabled={busy} onChange={(e) => onProfile(e.target.files?.[0])} />
          {profile.info && <small className="hint">{profile.name} · 영역 {profile.info.tableCount}개{profile.info.isProfile ? ' · 카메라 기준 프레임 포함' : ''}</small>}
          {profile.error && <small className="hint hint-error" role="alert">{profile.name}: {profile.error}</small>}
        </label>

        <div>
          <button type="submit" className="button" disabled={!canSubmit}>분석 시작</button>
        </div>
      </form>

      {busy && (
        <div className="card section" aria-live="polite">
          <StatusMessage kind="loading" title={STATUS_TEXT[job.status]}>
            {job.id && <>분석 id {job.id.slice(0, 8)}{percent !== null && ` · ${job.processed.toLocaleString()} / ${job.total.toLocaleString()} 프레임`}</>}
          </StatusMessage>
          {percent !== null && (
            <div className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
      )}

      {job.status === 'failed' && (
        <StatusMessage kind="error" title="분석 실패">
          {job.error} <button type="button" className="button-secondary" onClick={reset}>닫기</button>
        </StatusMessage>
      )}

      {job.status === 'completed' && (
        <StatusMessage kind="empty" title="분석 완료">
          결과를 상단 분석 선택에 반영했습니다.{job.storageNote && ` ${job.storageNote}`}{' '}
          <button type="button" className="button-secondary" onClick={() => onNavigate?.('time-series')}>시간대별 통계</button>{' '}
          <button type="button" className="button-secondary" onClick={() => onNavigate?.('table-usage')}>테이블 이용</button>
        </StatusMessage>
      )}
    </div>
  )
}

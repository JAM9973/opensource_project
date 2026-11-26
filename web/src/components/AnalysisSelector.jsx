import { useAnalysis } from '../context/AnalysisContext.jsx'
import { formatDateTime } from '../lib/format.js'
import { SAMPLE_ID } from '../sample/sampleResult.js'

export default function AnalysisSelector() {
  const { supabaseConfigured, sampleEnabled, list, refreshList, selectedId, select } = useAnalysis()
  const ids = new Set(list.items.map((row) => row.id))
  const orphan = selectedId && selectedId !== SAMPLE_ID && !ids.has(selectedId)

  return (
    <div className="selector">
      <label htmlFor="analysis-select">분석 선택</label>
      <div className="selector-row">
        <select id="analysis-select" value={selectedId ?? ''} onChange={(e) => select(e.target.value)} disabled={list.loading}>
          <option value="">{list.loading ? '목록 불러오는 중…' : '분석을 선택하세요'}</option>
          {sampleEnabled && <option value={SAMPLE_ID}>샘플 결과 (개발용)</option>}
          {orphan && <option value={selectedId}>{selectedId.slice(0, 8)} (현재 결과)</option>}
          {list.items.map((row) => (
            <option key={row.id} value={row.id}>
              {formatDateTime(row.created_at)} · {row.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <button type="button" className="button-secondary" onClick={refreshList} disabled={!supabaseConfigured || list.loading}>
          새로고침
        </button>
      </div>
      {!supabaseConfigured && <p className="hint">Supabase 환경변수가 없어 저장된 목록을 불러오지 않습니다.</p>}
      {list.error && <p className="hint hint-error" role="alert">{list.error}</p>}
      {supabaseConfigured && !list.loading && !list.error && list.items.length === 0 && (
        <p className="hint">저장된 분석이 없습니다. 행이 있는데 보이지 않으면 analyses 읽기 정책(RLS)을 확인하세요.</p>
      )}
    </div>
  )
}

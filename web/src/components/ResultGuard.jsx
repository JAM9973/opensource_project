import StatusMessage from './StatusMessage.jsx'

/**
 * 공통 상태 처리: 미선택 → 로딩 → 오류 → 결과 없음 순으로 확인하고,
 * 통과하면 children(result)를 렌더링한다. hasData로 화면별 "데이터 없음" 기준을 정한다.
 */
export default function ResultGuard({ analysisId, result, loading, error, hasData = (r) => Boolean(r), emptyText, children }) {
  if (!analysisId) return <StatusMessage kind="empty" title="분석을 선택하세요">상단에서 저장된 분석을 고르거나 새 분석을 요청하세요.</StatusMessage>
  if (loading) return <StatusMessage kind="loading">분석 결과를 불러오는 중입니다.</StatusMessage>
  if (error) return <StatusMessage kind="error">{error}</StatusMessage>
  if (!result || !hasData(result)) return <StatusMessage kind="empty">{emptyText ?? '이 분석에는 표시할 결과가 없습니다.'}</StatusMessage>
  return children(result)
}

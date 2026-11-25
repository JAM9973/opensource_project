import ResultGuard from '../../components/ResultGuard.jsx'

// FE-1: 시간대별 통계 화면 (그래프는 feat/fe1-time-series에서 구현)
export default function TimeSeriesPage(props) {
  return (
    <ResultGuard {...props} hasData={(r) => Array.isArray(r.time_series) && r.time_series.length > 0} emptyText="time_series 데이터가 없습니다.">
      {(result) => <p className="hint">time_series {result.time_series.length}개 구간을 불러왔습니다. 그래프는 준비 중입니다.</p>}
    </ResultGuard>
  )
}

import { lazy } from 'react'
import StatusMessage from './components/StatusMessage.jsx'
import NewAnalysisPage from './features/new-analysis/NewAnalysisPage.jsx'
import TimeSeriesPage from './features/time-series/TimeSeriesPage.jsx'

// FE-2 화면은 파일이 있을 때만 불러온다. 없으면 빈 객체 → 대체 화면 표시.
const tableUsageModules = import.meta.glob('./features/table-usage/TableUsagePage.jsx')
const loadTableUsage = Object.values(tableUsageModules)[0]
const TableUsagePage = loadTableUsage
  ? lazy(loadTableUsage)
  : function TableUsagePending() {
      return <StatusMessage kind="empty" title="테이블 이용 화면 준비 중">src/features/table-usage/TableUsagePage.jsx가 추가되면 이 자리에 표시됩니다.</StatusMessage>
    }

/**
 * 화면 목록. 모든 화면은 { analysisId, result, loading, error } props를 받는다.
 * usesResult=false인 화면은 선택한 분석과 무관하게 동작한다.
 */
export const pages = [
  { id: 'time-series', label: '시간대별 통계', Component: TimeSeriesPage, usesResult: true },
  { id: 'table-usage', label: '테이블 이용', Component: TableUsagePage, usesResult: true },
  { id: 'new-analysis', label: '새 분석', Component: NewAnalysisPage, usesResult: false },
]

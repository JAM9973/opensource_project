import { useEffect, useMemo, useState } from 'react'
import ChartCanvas from '../../components/ChartCanvas.jsx'
import ResultGuard from '../../components/ResultGuard.jsx'
import StatusMessage from '../../components/StatusMessage.jsx'
import { formatRange, formatVideoTime } from '../../lib/format.js'
import { formatDuration, formatSeconds, groupSessions, overview, peakDistribution, toSessions, toSummary } from './tableUsage.js'
import './tableUsage.css'

const ACCENT = '#2456d6'
const ACCENT_HOVER = '#1a44b0'
const DIMMED = '#c9d3ea'
const TEXT = '#1b1f24'
const MUTED = '#5c636e'
const GRID = '#eceef1'
const BORDER = '#d5d9de'
const ALL = '__all__'

const tooltip = (callbacks) => ({
  backgroundColor: '#ffffff',
  titleColor: TEXT,
  bodyColor: TEXT,
  borderColor: BORDER,
  borderWidth: 1,
  displayColors: false,
  padding: 10,
  callbacks,
})

const axisX = (title) => ({
  grid: { display: false },
  border: { color: BORDER },
  ticks: { color: MUTED, maxRotation: 0, autoSkip: true },
  title: { display: true, text: title, color: MUTED },
})

const axisY = (title, tickFormat, extra = {}) => ({
  beginAtZero: true,
  grid: { color: GRID },
  border: { display: false },
  ticks: { color: MUTED, callback: tickFormat, ...extra },
  title: { display: true, text: title, color: MUTED },
})

const barStyle = {
  borderRadius: { topLeft: 4, topRight: 4 },
  borderSkipped: 'bottom',
  categoryPercentage: 0.8,
  barPercentage: 0.9,
  maxBarThickness: 56,
}

/** 분 단위 눈금: 0, 1분, 2분 30초 … */
const minuteTick = (v) => {
  if (v === 0) return '0'
  if (v % 60 === 0 && v < 3600) return `${v / 60}분`
  return formatDuration(v)
}

function TableUsageView({ result }) {
  const sessions = useMemo(() => toSessions(result.table_sessions), [result])
  const summary = useMemo(() => toSummary(result.table_summary, sessions), [result, sessions])
  const grouped = useMemo(() => groupSessions(sessions), [sessions])
  const stats = useMemo(() => overview(summary, sessions), [summary, sessions])

  const [selected, setSelected] = useState(ALL)
  // 분석이 바뀌어 선택한 테이블이 사라지면 전체로 되돌린다.
  useEffect(() => {
    if (selected !== ALL && !summary.some((t) => t.tableId === selected)) setSelected(ALL)
  }, [summary, selected])

  const visibleSessions = selected === ALL ? sessions : grouped.get(selected) ?? []
  const selectedSummary = summary.find((t) => t.tableId === selected)

  const averageChart = useMemo(
    () => ({
      data: {
        labels: summary.map((t) => t.tableId),
        datasets: [
          {
            ...barStyle,
            data: summary.map((t) => (Number.isFinite(t.average) ? t.average : 0)),
            backgroundColor: summary.map((t) => (selected === ALL || t.tableId === selected ? ACCENT : DIMMED)),
            hoverBackgroundColor: ACCENT_HOVER,
          },
        ],
      },
      options: {
        animation: false,
        onClick: (_event, elements) => {
          if (!elements.length) return
          const id = summary[elements[0].index].tableId
          setSelected((cur) => (cur === id ? ALL : id))
        },
        onHover: (event, elements) => {
          if (event.native?.target) event.native.target.style.cursor = elements.length ? 'pointer' : 'default'
        },
        plugins: {
          legend: { display: false },
          tooltip: tooltip({
            title: (items) => `테이블 ${summary[items[0].dataIndex].tableId}`,
            label: (item) => {
              const t = summary[item.dataIndex]
              return [`평균 점유시간 ${formatDuration(t.average)} (${formatSeconds(t.average)})`, `세션 ${t.sessionCount}회 · 누적 ${formatDuration(t.total)}`]
            },
          }),
        },
        scales: {
          x: axisX('테이블'),
          y: axisY('평균 점유시간 (영상 재생시간)', minuteTick, { stepSize: 60 }),
        },
      },
    }),
    [summary, selected],
  )

  const distribution = useMemo(() => peakDistribution(visibleSessions), [visibleSessions])
  const distributionChart = useMemo(
    () => ({
      data: {
        labels: distribution.map((d) => `${d.peak}명`),
        datasets: [{ ...barStyle, data: distribution.map((d) => d.count), backgroundColor: ACCENT, hoverBackgroundColor: ACCENT_HOVER }],
      },
      options: {
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: tooltip({
            title: (items) => `최대 동시 검출 ${distribution[items[0].dataIndex].peak}명`,
            label: (item) => `세션 ${distribution[item.dataIndex].count}회`,
          }),
        },
        scales: {
          x: axisX('세션의 최대 동시 검출 인원'),
          y: axisY('세션 수', (v) => (Number.isInteger(v) ? `${v}회` : ''), { precision: 0, stepSize: 1 }),
        },
      },
    }),
    [distribution],
  )

  const scopeLabel = selected === ALL ? '전체 테이블' : `테이블 ${selected}`

  return (
    <>
      <dl className="stats">
        <div className="stat">
          <dt>테이블 수</dt>
          <dd>{stats.tableCount}개<span className="sub">세션이 기록된 테이블</span></dd>
        </div>
        <div className="stat">
          <dt>전체 세션</dt>
          <dd>{stats.totalSessions}회<span className="sub">평균 점유 {formatDuration(stats.averageDuration)}</span></dd>
        </div>
        <div className="stat">
          <dt>누적 점유 최다</dt>
          <dd>
            {stats.busiest ? `테이블 ${stats.busiest.tableId}` : '-'}
            <span className="sub">{stats.busiest ? `누적 ${formatDuration(stats.busiest.total)}` : '데이터 없음'}</span>
          </dd>
        </div>
        <div className="stat">
          <dt>가장 긴 세션</dt>
          <dd>
            {stats.longest ? formatDuration(stats.longest.duration) : '-'}
            <span className="sub">{stats.longest ? `테이블 ${stats.longest.tableId} · ${formatRange(stats.longest.start, stats.longest.end)}` : '데이터 없음'}</span>
          </dd>
        </div>
      </dl>

      <section className="section card">
        <div className="section-head">
          <h2>테이블별 평균 점유시간</h2>
          <span className="hint">막대를 누르면 해당 테이블 기록을 봅니다</span>
        </div>
        {summary.length ? (
          <ChartCanvas type="bar" data={averageChart.data} options={averageChart.options} label="테이블별 평균 점유시간 막대 그래프" />
        ) : (
          <StatusMessage kind="empty">테이블 요약(table_summary)이 없습니다.</StatusMessage>
        )}

        <table className="data tu-summary">
          <thead>
            <tr>
              <th scope="col">테이블</th>
              <th scope="col">세션 수</th>
              <th scope="col">평균 점유시간</th>
              <th scope="col">누적 점유시간</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((t) => {
              const active = t.tableId === selected
              return (
                <tr key={t.tableId} className={active ? 'is-selected' : undefined}>
                  <td>
                    <button type="button" className="tu-link" aria-pressed={active} onClick={() => setSelected(active ? ALL : t.tableId)}>
                      {t.tableId}
                    </button>
                  </td>
                  <td>{Number.isFinite(t.sessionCount) ? `${t.sessionCount}회` : '-'}</td>
                  <td>
                    {formatDuration(t.average)} <span className="tu-sec">{formatSeconds(t.average)}</span>
                  </td>
                  <td>
                    {formatDuration(t.total)} <span className="tu-sec">{formatSeconds(t.total)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="section card">
        <div className="section-head">
          <h2>테이블 이용 기록</h2>
          <span className="hint">시각은 영상 재생시간 기준 (분:초)</span>
        </div>

        <div className="tu-picker" role="group" aria-label="테이블 선택">
          {[{ tableId: ALL }, ...summary].map((t) => {
            const active = t.tableId === selected
            const count = t.tableId === ALL ? sessions.length : grouped.get(t.tableId)?.length ?? 0
            return (
              <button key={t.tableId} type="button" className={active ? 'tu-chip active' : 'tu-chip'} aria-pressed={active} onClick={() => setSelected(t.tableId)}>
                {t.tableId === ALL ? '전체' : t.tableId}
                <span className="tu-count">{count}</span>
              </button>
            )
          })}
        </div>

        {selectedSummary && (
          <p className="hint">
            테이블 {selectedSummary.tableId}: 세션 {selectedSummary.sessionCount}회 · 평균 {formatDuration(selectedSummary.average)} · 누적 {formatDuration(selectedSummary.total)}
          </p>
        )}

        {visibleSessions.length ? (
          <div className="tu-scroll">
            <table className="data">
              <thead>
                <tr>
                  {selected === ALL && <th scope="col">테이블</th>}
                  <th scope="col">시작</th>
                  <th scope="col">종료</th>
                  <th scope="col">점유시간</th>
                  <th scope="col">최대 동시 검출 인원</th>
                </tr>
              </thead>
              <tbody>
                {visibleSessions.map((s, i) => (
                  <tr key={`${s.tableId}-${s.start}-${i}`}>
                    {selected === ALL && <td>{s.tableId}</td>}
                    <td>{formatVideoTime(s.start)}</td>
                    <td>{formatVideoTime(s.end)}</td>
                    <td>
                      {formatDuration(s.duration)} <span className="tu-sec">{formatSeconds(s.duration)}</span>
                    </td>
                    <td>{Number.isFinite(s.peak) ? `${s.peak}명` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <StatusMessage kind="empty">{scopeLabel}의 이용 기록(table_sessions)이 없습니다.</StatusMessage>
        )}
      </section>

      <section className="section card">
        <div className="section-head">
          <h2>최대 동시 검출 인원 분포 · {scopeLabel}</h2>
          <span className="hint">세션마다 한 번에 가장 많이 검출된 인원 (고유 방문자 수 아님)</span>
        </div>
        {distribution.length ? (
          <ChartCanvas type="bar" data={distributionChart.data} options={distributionChart.options} label={`${scopeLabel} 최대 동시 검출 인원 분포 막대 그래프`} height={220} />
        ) : (
          <StatusMessage kind="empty">{scopeLabel}에 최대 동시 검출 인원(peak_people) 값이 없습니다.</StatusMessage>
        )}
      </section>
    </>
  )
}

export default function TableUsagePage({ analysisId, result, loading, error }) {
  return (
    <ResultGuard
      analysisId={analysisId}
      result={result}
      loading={loading}
      error={error}
      hasData={(r) => toSessions(r.table_sessions).length > 0 || toSummary(r.table_summary, []).length > 0}
      emptyText="이 분석에는 테이블 이용 데이터(table_summary, table_sessions)가 없습니다."
    >
      {(r) => <TableUsageView key={analysisId} result={r} />}
    </ResultGuard>
  )
}

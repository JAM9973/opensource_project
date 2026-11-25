import { useMemo } from 'react'
import ChartCanvas from '../../components/ChartCanvas.jsx'
import ResultGuard from '../../components/ResultGuard.jsx'
import { formatNumber, formatPercent, formatRange, formatVideoTime } from '../../lib/format.js'
import { summarize, toRows } from './timeSeries.js'

const ACCENT = '#2456d6'
const TEXT = '#1b1f24'
const MUTED = '#5c636e'
const GRID = '#eceef1'

function barOptions({ yTitle, max, tickFormat, tooltipLabel, rows }) {
  return {
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor: TEXT,
        bodyColor: TEXT,
        borderColor: '#d5d9de',
        borderWidth: 1,
        displayColors: false,
        padding: 10,
        callbacks: {
          title: (items) => `영상 ${formatRange(rows[items[0].dataIndex].start, rows[items[0].dataIndex].end)}`,
          label: (item) => tooltipLabel(rows[item.dataIndex]),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: '#d5d9de' },
        ticks: { color: MUTED, maxRotation: 0, autoSkip: true },
        title: { display: true, text: '영상 재생시간 (구간 시작)', color: MUTED },
      },
      y: {
        beginAtZero: true,
        max,
        grid: { color: GRID },
        border: { display: false },
        ticks: { color: MUTED, callback: tickFormat },
        title: { display: true, text: yTitle, color: MUTED },
      },
    },
  }
}

function barDataset(values) {
  return {
    data: values,
    backgroundColor: ACCENT,
    hoverBackgroundColor: '#1a44b0',
    borderRadius: { topLeft: 4, topRight: 4 },
    borderSkipped: 'bottom',
    categoryPercentage: 0.9,
    barPercentage: 0.92,
    maxBarThickness: 48,
  }
}

function TimeSeriesView({ result }) {
  const rows = useMemo(() => toRows(result.time_series), [result])
  const summary = useMemo(() => summarize(rows), [rows])
  const labels = useMemo(() => rows.map((r) => formatVideoTime(r.start)), [rows])

  const people = useMemo(
    () => ({
      data: { labels, datasets: [barDataset(rows.map((r) => r.people))] },
      options: barOptions({
        rows,
        yTitle: '평균 인원 (명)',
        tickFormat: (v) => `${v}명`,
        tooltipLabel: (r) => `평균 인원 ${formatNumber(r.people)}명`,
      }),
    }),
    [rows, labels],
  )

  const occupancy = useMemo(
    () => ({
      data: { labels, datasets: [barDataset(rows.map((r) => r.rate * 100))] },
      options: barOptions({
        rows,
        yTitle: '점유율 (%)',
        max: 100,
        tickFormat: (v) => `${v}%`,
        tooltipLabel: (r) => `점유율 ${formatPercent(r.rate)}`,
      }),
    }),
    [rows, labels],
  )

  const basis = result.time_basis
  const speed = Number(basis?.speed_factor ?? 1)
  const duration = Number(result.duration_seconds ?? summary.covered)

  return (
    <>
      <dl className="stats">
        <div className="stat">
          <dt>분석 길이</dt>
          <dd>{formatVideoTime(duration)}<span className="sub">영상 재생시간</span></dd>
        </div>
        <div className="stat">
          <dt>전체 평균 인원</dt>
          <dd>{formatNumber(summary.avgPeople)}명<span className="sub">최대 구간 {formatNumber(summary.peakPeople.people)}명 ({formatRange(summary.peakPeople.start, summary.peakPeople.end)})</span></dd>
        </div>
        <div className="stat">
          <dt>전체 평균 점유율</dt>
          <dd>{formatPercent(summary.avgRate)}<span className="sub">최고 구간 {formatPercent(summary.peakRate.rate)} ({formatRange(summary.peakRate.start, summary.peakRate.end)})</span></dd>
        </div>
      </dl>

      {speed !== 1 && (
        <p className="hint">이 결과는 배속 {speed}가 적용된 시간입니다 (원본 영상 {formatVideoTime(Number(basis?.video_duration_seconds))}).</p>
      )}

      <section className="section card">
        <div className="section-head">
          <h2>시간대별 평균 인원</h2>
          <span className="hint">좌석 영역 안에서 검출된 인원의 구간 평균</span>
        </div>
        <ChartCanvas type="bar" data={people.data} options={people.options} label="시간대별 평균 인원 막대 그래프" />
      </section>

      <section className="section card">
        <div className="section-head">
          <h2>시간대별 점유율</h2>
          <span className="hint">사람이 있는 테이블 비율의 구간 평균</span>
        </div>
        <ChartCanvas type="bar" data={occupancy.data} options={occupancy.options} label="시간대별 점유율 막대 그래프" />
      </section>

      <details>
        <summary>구간별 수치 표 ({rows.length}개 구간)</summary>
        <table className="data">
          <thead>
            <tr>
              <th scope="col">구간 (영상 재생시간)</th>
              <th scope="col">평균 인원</th>
              <th scope="col">점유율</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.start}>
                <td>{formatRange(r.start, r.end)}</td>
                <td>{formatNumber(r.people, 2)}명</td>
                <td>{formatPercent(r.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  )
}

export default function TimeSeriesPage({ analysisId, result, loading, error }) {
  return (
    <ResultGuard
      analysisId={analysisId}
      result={result}
      loading={loading}
      error={error}
      hasData={(r) => toRows(r.time_series).length > 0}
      emptyText="이 분석에는 시간대별 데이터(time_series)가 없습니다."
    >
      {(r) => <TimeSeriesView result={r} />}
    </ResultGuard>
  )
}

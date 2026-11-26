/** result.time_series → 화면용 행. 잘못된 행은 제외한다. */
export function toRows(timeSeries) {
  if (!Array.isArray(timeSeries)) return []
  return timeSeries
    .map((r) => ({
      start: Number(r?.start_second),
      end: Number(r?.end_second),
      people: Number(r?.average_people),
      rate: Number(r?.occupancy_rate),
    }))
    .filter((r) => [r.start, r.end, r.people, r.rate].every(Number.isFinite) && r.end > r.start)
    .sort((a, b) => a.start - b.start)
}

/** 구간 길이로 가중한 전체 평균과 최댓값 구간 */
export function summarize(rows) {
  const total = rows.reduce((sum, r) => sum + (r.end - r.start), 0)
  const weighted = (key) => (total ? rows.reduce((sum, r) => sum + r[key] * (r.end - r.start), 0) / total : NaN)
  const peak = (key) => rows.reduce((best, r) => (!best || r[key] > best[key] ? r : best), null)
  return {
    covered: total,
    avgPeople: weighted('people'),
    avgRate: weighted('rate'),
    peakPeople: peak('people'),
    peakRate: peak('rate'),
  }
}

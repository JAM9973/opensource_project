// 테이블 이용 결과 정리. result.table_summary / result.table_sessions를 화면용으로 바꾼다.
// 시간은 모두 영상 재생시간 기준 초. peak_people은 세션 동안의 "최대 동시 검출 인원"이다.

const toNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

/** "T2" < "T10" 처럼 숫자를 고려해 테이블 ID 정렬 */
export const compareTableId = (a, b) => String(a).localeCompare(String(b), 'ko', { numeric: true })

/** table_sessions → 시작 시각 순 세션 목록 (table_id 없는 행은 제외) */
export function toSessions(rawSessions) {
  if (!Array.isArray(rawSessions)) return []
  return rawSessions
    .filter((s) => s && s.table_id != null && s.table_id !== '')
    .map((s) => {
      const start = toNumber(s.start_second)
      const end = toNumber(s.end_second)
      const given = toNumber(s.duration_seconds)
      return {
        tableId: String(s.table_id),
        start,
        end,
        duration: Number.isFinite(given) ? given : end - start,
        peak: toNumber(s.peak_people),
      }
    })
    .sort((a, b) => (a.start || 0) - (b.start || 0))
}

/**
 * table_summary → 테이블별 요약. table_summary가 없으면 세션에서 계산한다.
 * 요약에 없고 세션에만 있는 테이블도 함께 보여준다.
 */
export function toSummary(rawSummary, sessions) {
  const byTable = new Map()

  if (Array.isArray(rawSummary)) {
    for (const s of rawSummary) {
      if (!s || s.table_id == null || s.table_id === '') continue
      byTable.set(String(s.table_id), {
        tableId: String(s.table_id),
        sessionCount: toNumber(s.session_count),
        average: toNumber(s.average_duration_seconds),
        total: toNumber(s.total_occupied_seconds),
      })
    }
  }

  const grouped = groupSessions(sessions)
  for (const [tableId, rows] of grouped) {
    if (byTable.has(tableId)) continue
    const total = rows.reduce((sum, r) => sum + (Number.isFinite(r.duration) ? r.duration : 0), 0)
    byTable.set(tableId, { tableId, sessionCount: rows.length, average: rows.length ? total / rows.length : NaN, total })
  }

  return [...byTable.values()].sort((a, b) => compareTableId(a.tableId, b.tableId))
}

export function groupSessions(sessions) {
  const map = new Map()
  for (const s of sessions) {
    if (!map.has(s.tableId)) map.set(s.tableId, [])
    map.get(s.tableId).push(s)
  }
  return map
}

/** 최대 동시 검출 인원별 세션 수. 최소~최대 사이 빈 값도 0으로 채운다. */
export function peakDistribution(sessions) {
  const peaks = sessions.map((s) => s.peak).filter((p) => Number.isFinite(p) && p >= 0).map(Math.round)
  if (!peaks.length) return []
  const min = Math.min(...peaks)
  const max = Math.max(...peaks)
  const counts = new Map(peaks.map((p) => [p, 0]))
  for (const p of peaks) counts.set(p, counts.get(p) + 1)
  const rows = []
  for (let p = min; p <= max; p += 1) rows.push({ peak: p, count: counts.get(p) ?? 0 })
  return rows
}

/** 전체 요약 수치 */
export function overview(summary, sessions) {
  const totalSessions = summary.reduce((sum, t) => sum + (Number.isFinite(t.sessionCount) ? t.sessionCount : 0), 0)
  const totalOccupied = summary.reduce((sum, t) => sum + (Number.isFinite(t.total) ? t.total : 0), 0)
  const busiest = summary.reduce((best, t) => (Number.isFinite(t.total) && (!best || t.total > best.total) ? t : best), null)
  const longest = sessions.reduce((best, s) => (Number.isFinite(s.duration) && (!best || s.duration > best.duration) ? s : best), null)
  return {
    tableCount: summary.length,
    totalSessions,
    averageDuration: totalSessions ? totalOccupied / totalSessions : NaN,
    busiest,
    longest,
  }
}

/** 초 → "4분 48초" (1시간 이상이면 "1시간 2분 3초") */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '-'
  const total = Math.round(seconds)
  if (total < 60) return `${total}초`
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h && `${h}시간`, (h || m) && `${m}분`, `${s}초`].filter(Boolean).join(' ')
}

/** 초 → "288.8초" */
export function formatSeconds(seconds) {
  if (!Number.isFinite(seconds)) return '-'
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}초`
}

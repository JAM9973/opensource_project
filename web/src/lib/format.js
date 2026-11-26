/** 영상 재생시간(초) → "m:ss" 또는 "h:mm:ss" */
export function formatVideoTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '-'
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

export function formatRange(start, end) {
  return `${formatVideoTime(start)}–${formatVideoTime(end)}`
}

/** 0~1 비율 → "42.5%" */
export function formatPercent(rate, digits = 1) {
  if (!Number.isFinite(rate)) return '-'
  return `${(rate * 100).toFixed(digits)}%`
}

export function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return '-'
  return value.toFixed(digits)
}

export function formatDateTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

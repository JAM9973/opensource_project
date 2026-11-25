const base = (import.meta.env.VITE_MODEL_API_BASE_URL ?? '').replace(/\/+$/, '')

export const apiConfigured = Boolean(base)

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, init) {
  if (!base) throw new ApiError('VITE_MODEL_API_BASE_URL이 설정되지 않았습니다.', 0)
  let response
  try {
    response = await fetch(`${base}${path}`, init)
  } catch {
    throw new ApiError('분석 API에 연결할 수 없습니다. 서버 주소와 CORS 설정을 확인하세요.', 0)
  }
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  if (!response.ok) {
    const detail = body?.detail
    const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : `요청 실패 (HTTP ${response.status})`
    throw new ApiError(message, response.status)
  }
  if (!body) throw new ApiError('API 응답을 읽을 수 없습니다.', response.status)
  return body
}

/**
 * POST /api/analyses
 * @param {File} video 영상 파일
 * @param {string} profileText 저장된 영역 프로필 JSON 문자열 (그대로 tables로 전송)
 */
export function createAnalysis(video, profileText) {
  const form = new FormData()
  form.append('video', video)
  form.append('tables', profileText)
  form.append('speed_factor', '1')
  return request('/api/analyses', { method: 'POST', body: form })
}

/** GET /api/analyses/{id} → { id, status, processed_frames?, total_frames?, result?, error?, storage? } */
export function getAnalysis(id) {
  return request(`/api/analyses/${encodeURIComponent(id)}`)
}

/**
 * 프로필 JSON 확인. backend와 같은 형식({ tables: [...] } 또는 좌표 배열)인지 검사하고 테이블 수를 돌려준다.
 */
export function inspectProfile(text) {
  let value
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('JSON 형식이 아닙니다.')
  }
  const tables = Array.isArray(value) ? value : value?.tables
  if (!Array.isArray(tables) || tables.length === 0) throw new Error('tables 배열이 없습니다.')
  const invalid = tables.find((t) => !t?.table_id || !Array.isArray(t.points) || t.points.length < 3)
  if (invalid) throw new Error('각 영역에는 table_id와 3개 이상의 points가 필요합니다.')
  return { tableCount: tables.length, isProfile: !Array.isArray(value) }
}

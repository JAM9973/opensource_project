import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigured = Boolean(url && key)

// 환경변수가 없으면 null. 화면은 샘플·API 결과만으로도 동작한다.
export const supabase = supabaseConfigured
  ? createClient(url, key, { auth: { persistSession: false } })
  : null

function parseResult(value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      throw new Error('저장된 결과(result)를 읽을 수 없습니다.')
    }
  }
  return value ?? null
}

/** analyses 목록 (최신순). result는 크기가 클 수 있어 제외한다. */
export async function listAnalyses(limit = 50) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('analyses')
    .select('id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`분석 목록 조회 실패: ${error.message}`)
  return data ?? []
}

/** 선택한 행의 result. 행이 없으면 null. */
export async function fetchAnalysisResult(id) {
  if (!supabase) throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  const { data, error } = await supabase
    .from('analyses')
    .select('id, result')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`분석 결과 조회 실패: ${error.message}`)
  return data ? parseResult(data.result) : null
}

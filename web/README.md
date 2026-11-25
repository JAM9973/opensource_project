# 웹 (React + Vite)

## 실행

```powershell
cd web
npm install
Copy-Item .env.example .env.local   # 값 입력, 커밋 금지
npm run dev                          # http://localhost:5173
npm run build                        # dist/ 생성
```

| 변수 | 내용 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable(anon) 키. secret 키는 넣지 않는다 |
| `VITE_MODEL_API_BASE_URL` | 분석 API 주소 (예: `http://localhost:8000`, ngrok 주소) |

Supabase 값이 없어도 실행된다. 개발 모드(`npm run dev`)에서는 분석 선택에 **샘플 결과**가 나와 화면을 바로 확인할 수 있다. `analyses`에 행이 있는데 목록이 비면 브라우저 읽기 정책(RLS)을 DB 담당자와 확인한다.

## 구조

```
src/
  context/AnalysisContext.jsx   선택한 분석과 result 공통 상태
  components/                   분석 선택, 상태 표시, ResultGuard, ChartCanvas
  features/time-series/         FE-1 시간대별 통계
  features/table-usage/         FE-2 테이블 이용 (TableUsagePage.jsx)
  pages.jsx                     화면 목록(탭)
  lib/                          Supabase 조회, 시간·% 포맷
```

## 화면 추가 규칙 (FE-2)

- 파일: `src/features/table-usage/TableUsagePage.jsx`, `export default function TableUsagePage`
- props: `{ analysisId, result, loading, error }` — 상단에서 고른 분석(또는 방금 끝난 API 분석)의 result가 그대로 들어온다.
- 파일이 없으면 "준비 중" 화면이 대신 표시된다. 파일을 추가하면 자동으로 연결된다.
- 공통 도구: `ResultGuard`(로딩·오류·데이터 없음 처리), `ChartCanvas`(Chart.js), `lib/format.js`(`formatVideoTime`, `formatPercent`).
- result 구조: `time_series`, `table_sessions`, `table_summary`, `duration_seconds`, `time_basis`, `video` (`backend/analysis.py` 참고). 시간은 영상 재생시간 기준 초, 점유율은 0~1.

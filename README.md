# 식당 테이블 영상 분석

Python 영상 분석 서버 초안. React 화면 두 개는 각 담당자가 별도로 구현한다.

## 실행

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env
.venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

API 문서: http://localhost:8000/docs

`POST /api/analyses`: multipart의 `video`에 영상, `tables`에 테이블 영역 JSON 배열을 보낸다.

```json
[{"table_id":"T1","points":[[100,100],[400,100],[400,400],[100,400]]}]
```

영역은 원본 영상 픽셀 좌표이며 사람 바운딩 박스 중심이 포함되는 좌석 영역으로 지정한다. 겹치는 영역은 배열에서 첫 영역에 배정한다. 최초 실행은 yolo11n.pt 다운로드가 필요하다.

응답의 id로 `GET /api/analyses/{id}`를 조회한다. completed 결과는 time_series와 table_sessions다. 시간은 영상 시작 기준 초, occupancy_rate는 0~1, average_people은 해당 구간 전체 인원의 프레임 평균이다. peak_people은 테이블 이용 구간의 최대 동시 인원이며 실제 고유 방문자 수가 아니다. 마지막 검출 시점과 최초 검출 시점 차이를 점유시간으로 산출하므로 정확한 퇴장 시각과 다를 수 있다. 3초 이하의 검출 누락은 같은 세션으로 합친다.

Supabase 설정이 없으면 data 폴더에 JSON으로 보관한다. 현재 Supabase 저장은 analyses.result JSON 한 건이며, 담당자와 협의 후 정규화된 time_series 및 table_sessions 테이블로 분리해야 한다. 저장 실패는 failed 상태와 서버 로그로 확인한다.

## 연결

ngrok 설치·인증 후 `ngrok http 8000`을 실행한다. .env의 CORS_ORIGINS에 실제 Vercel 주소를 쉼표로 추가한다. 서버와 ngrok을 실행 상태로 유지한다. 현재 API 인증이 없으므로 외부 공개 전 인증과 요청 제한을 추가해야 한다. 실제 영상이나 비밀 키는 Git에 올리지 않는다.

현재 문법 검사만 수행했으며 실제 영상·모델 및 Supabase 연결 검증은 아직 하지 않았다. 분석 작업은 단일 프로세스에서 직렬 실행하며 서버 재시작 시 진행 중 작업을 복구하지 않는다.

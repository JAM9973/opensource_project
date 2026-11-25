# 식당 테이블 영상 분석

YOLO11s로 테이블·의자 영역을 제안하고 YOLO11n·ByteTrack으로 사람을 추적하고, 테이블별 인원·점유시간을 집계한다. 시간은 영상 재생시간 기준 초이며 실제 촬영 시각이나 실제 체류시간으로 해석하지 않는다.

## 설치

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

## 1 자동 생성

```powershell
.venv\Scripts\python -m backend.region_editor 영상.mp4 --profile data/camera.json
```

영상 여러 프레임에서 테이블과 의자를 검출하고, 카메라 이동을 보정해 좌석 영역 후보를 생성한다. 첫 실행 시 모델을 다운로드한다. 테이블·의자 연결은 거리 기반 추정이므로 다음 단계에서 확인한다. 검출되지 않은 테이블은 직접 추가한다.

## 2 영역 확인과 수정

영상 위 편집 창에서 영역을 선택하고 꼭짓점을 드래그한다. 하단 Frame 슬라이더로 다른 프레임에서도 위치를 확인한다.

| 조작 | 기능 |
|---|---|
| N → 꼭짓점 클릭 → Enter | 영역 추가 |
| 영역 선택 → D | 영역 삭제 |
| U | 직전 수정 취소 |
| Esc | 추가 중인 영역 취소 |
| S | 좌표와 카메라 기준 프레임 저장 후 닫기 |
| Q | 저장 없이 닫기 |

같은 명령을 다시 실행하면 저장된 프로필을 현재 영상과 정합한 뒤 불러온다. 다른 구도이거나 영역이 화면 밖이면 재사용을 거부한다. 새 구도는 `--regenerate`로 다시 생성한다. `--generate-only`는 편집 창 없이 미검토 후보를 저장한다.

## 3 분석

```powershell
.venv\Scripts\python -m backend.cli 영상.mp4 --tables data/camera.json --output data/result.json --annotated data/result.mp4
```

결과는 시간대별 평균 인원·점유율(time_series), 테이블 이용 세션(table_sessions), 테이블별 평균 점유시간(table_summary)이다. 점유율은 0~1, 점유시간은 초 단위다. 3초 이하 검출 공백은 같은 세션으로 합친다. peak_people은 최대 동시 검출 인원이며 고유 방문자 수가 아니다.

사람 바운딩 박스의 중심이 포함된 좌석 영역으로 배정한다. 영역이 겹치면 배열에서 첫 영역을 우선하므로 통로와 인접 테이블이 겹치지 않게 조정한다. 구도가 크게 바뀌거나 테이블이 화면 밖으로 사라지면 영상을 구간별로 분석한다. ORB·RANSAC 보정은 배경 특징이 부족하거나 심한 시점 변화가 있을 때 실패할 수 있다.

## API 연결

```powershell
.venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

API 문서: http://localhost:8000/docs

- POST /api/layouts: multipart `video` → 자동 영역과 카메라 기준 프레임을 담은 프로필 JSON 반환.
- POST /api/analyses: multipart `video`, `tables`(수정·저장한 프로필 JSON 문자열 또는 좌표 배열) → 분석 id 반환.
- GET /api/analyses/{id}: 진행 상태와 결과 조회.

프론트 담당자는 프로필의 tables 좌표를 편집해 저장하고, 같은 프로필을 분석 요청에 전달하면 된다. 프로필에는 기준 프레임 이미지가 포함되므로 Git에 올리지 않는다. 동시 영상 작업은 한 건만 허용한다. 진행 중 분석은 재시작 시 복구되지 않는다.

Supabase URL과 서버용 비밀 키는 .env에 설정한다. 미설정 시 data에 JSON 결과를 저장하고, 설정 시 analyses.result에도 저장한다. 저장 실패 시 로컬 결과를 유지한다. supabase/schema.sql은 DB 담당자와 협의할 초기안이다. 브라우저 조회 정책은 별도로 구성한다.

ngrok 연결은 `ngrok http 8000`. CORS_ORIGINS에 실제 Vercel 주소를 설정한다. API 인증은 아직 없으므로 접근 제한을 적용한 뒤 외부에 공개한다.

## 웹

```powershell
cd web
npm install
Copy-Item .env.example .env.local
npm run dev
```

환경변수와 화면 구조는 web/README.md 참고.

## 검증

```powershell
.venv\Scripts\python -m unittest discover -s tests -v
```

통계 계산, API 업로드·상태 조회, 좌표 편집·추가·삭제·저장·재사용, 다른 구도 차단을 검사한다. RestaurantTest.mp4의 12개 샘플 프레임에서 자동 후보 7개를 생성했다. 누락·과대 영역을 편집 동작으로 보정해 9개 영역을 저장·재사용하고, 전체 300프레임(30fps·10초)을 분석해 통계 JSON과 표시 영상을 저장했다. 편집 이벤트 및 API 자동 테스트 15개가 통과했다. 실제 편집 창 실행은 확인했지만 UI 자동 조작 도구의 시간 초과로 화면 직접 조작 검증은 완료하지 못했다. 자동 영역 정확도는 보장되지 않으며 수동 확인이 필요하다. 다운로드 영상·프레임·프로필·모델은 data 또는 Git 제외 경로에 보관한다.

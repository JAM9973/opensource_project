-- 담당자 협의용 초기 저장소. 실제 통계 테이블은 별도 합의 후 구성한다.
create table if not exists public.analyses (
  id uuid primary key,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.analyses enable row level security;
-- 기본은 브라우저 읽기 차단. 조회 정책은 담당자가 공개 범위를 합의한 후 추가한다.

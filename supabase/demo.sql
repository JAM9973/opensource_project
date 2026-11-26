-- Public demo row matching web/src/sample/sampleResult.js.
-- Run after schema.sql. The fixed UUID makes the demo easy to find and re-run.
insert into public.analyses (id, result, is_public)
values (
  '00000000-0000-4000-8000-000000000001'::uuid,
  $demo${"time_series":[{"start_second":0,"end_second":60,"average_people":0.8,"occupancy_rate":0.22},{"start_second":60,"end_second":120,"average_people":1.6,"occupancy_rate":0.33},{"start_second":120,"end_second":180,"average_people":2.9,"occupancy_rate":0.56},{"start_second":180,"end_second":240,"average_people":4.2,"occupancy_rate":0.78},{"start_second":240,"end_second":300,"average_people":5.1,"occupancy_rate":0.89},{"start_second":300,"end_second":360,"average_people":4.6,"occupancy_rate":0.78},{"start_second":360,"end_second":420,"average_people":3.3,"occupancy_rate":0.67},{"start_second":420,"end_second":480,"average_people":2.1,"occupancy_rate":0.44},{"start_second":480,"end_second":540,"average_people":1.4,"occupancy_rate":0.33},{"start_second":540,"end_second":584.5,"average_people":0.9,"occupancy_rate":0.22}],"table_sessions":[{"table_id":"T1","start_second":12.4,"end_second":301.2,"duration_seconds":288.8,"peak_people":3},{"table_id":"T2","start_second":65.0,"end_second":410.6,"duration_seconds":345.6,"peak_people":2},{"table_id":"T3","start_second":130.3,"end_second":455.0,"duration_seconds":324.7,"peak_people":4},{"table_id":"T1","start_second":340.1,"end_second":560.9,"duration_seconds":220.8,"peak_people":2}],"table_summary":[{"table_id":"T1","session_count":2,"average_duration_seconds":254.8,"total_occupied_seconds":509.6},{"table_id":"T2","session_count":1,"average_duration_seconds":345.6,"total_occupied_seconds":345.6},{"table_id":"T3","session_count":1,"average_duration_seconds":324.7,"total_occupied_seconds":324.7}],"duration_seconds":584.5,"time_basis":{"basis":"video_playback","unit":"seconds","speed_factor":1,"video_duration_seconds":584.5},"video":{"width":1280,"height":720,"fps":30,"processed_frames":17535}}$demo$::jsonb,
  true
)
on conflict (id) do update
set result = excluded.result,
    is_public = true;

-- Verify the public demo row (run as SQL Editor / database owner).
select id, created_at, is_public,
       jsonb_typeof(result->'time_series') as time_series_type,
       jsonb_typeof(result->'table_sessions') as table_sessions_type,
       jsonb_typeof(result->'table_summary') as table_summary_type
from public.analyses
where id = '00000000-0000-4000-8000-000000000001'::uuid;

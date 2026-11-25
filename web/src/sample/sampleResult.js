// 개발·화면 확인용 샘플. backend/analysis.py 결과 구조와 같다.
export const SAMPLE_ID = 'sample'

const buckets = [
  [0.8, 0.22], [1.6, 0.33], [2.9, 0.56], [4.2, 0.78], [5.1, 0.89],
  [4.6, 0.78], [3.3, 0.67], [2.1, 0.44], [1.4, 0.33], [0.9, 0.22],
]

export const sampleResult = {
  time_series: buckets.map(([people, rate], i) => ({
    start_second: i * 60,
    end_second: i === buckets.length - 1 ? 584.5 : (i + 1) * 60,
    average_people: people,
    occupancy_rate: rate,
  })),
  table_sessions: [
    { table_id: 'T1', start_second: 12.4, end_second: 301.2, duration_seconds: 288.8, peak_people: 3 },
    { table_id: 'T2', start_second: 65.0, end_second: 410.6, duration_seconds: 345.6, peak_people: 2 },
    { table_id: 'T3', start_second: 130.3, end_second: 455.0, duration_seconds: 324.7, peak_people: 4 },
    { table_id: 'T1', start_second: 340.1, end_second: 560.9, duration_seconds: 220.8, peak_people: 2 },
  ],
  table_summary: [
    { table_id: 'T1', session_count: 2, average_duration_seconds: 254.8, total_occupied_seconds: 509.6 },
    { table_id: 'T2', session_count: 1, average_duration_seconds: 345.6, total_occupied_seconds: 345.6 },
    { table_id: 'T3', session_count: 1, average_duration_seconds: 324.7, total_occupied_seconds: 324.7 },
  ],
  duration_seconds: 584.5,
  time_basis: { basis: 'video_playback', unit: 'seconds', speed_factor: 1, video_duration_seconds: 584.5 },
  video: { width: 1280, height: 720, fps: 30, processed_frames: 17535 },
}

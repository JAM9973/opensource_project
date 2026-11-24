"""Video-time based occupancy aggregation; no wall-clock timestamps are inferred."""
from collections import defaultdict


def aggregate(samples, tables, duration, gap=3.0, bucket=60):
    sessions, series = [], []
    active, bins = {}, defaultdict(list)
    for second, counts in samples:
        bins[int(second // bucket)].append(counts)
        for table in tables:
            count = counts.get(table, 0)
            if count:
                if table not in active:
                    active[table] = [second, second, count]
                active[table][1] = second
                active[table][2] = max(active[table][2], count)
            elif table in active and second - active[table][1] > gap:
                start, last, peak = active.pop(table)
                sessions.append(dict(table_id=table, start_second=start,
                    end_second=last, duration_seconds=last-start, peak_people=peak))
    for table, (start, last, peak) in active.items():
        sessions.append(dict(table_id=table, start_second=start,
            end_second=last, duration_seconds=last-start, peak_people=peak))
    for index, rows in sorted(bins.items()):
        series.append(dict(start_second=index*bucket,
            end_second=min((index+1)*bucket, duration),
            average_people=sum(sum(r.values()) for r in rows)/len(rows),
            occupancy_rate=sum(sum(v>0 for v in r.values())/len(tables) for r in rows)/len(rows)))
    return dict(time_series=series, table_sessions=sessions, duration_seconds=duration)


def analyze(path, polygons, model_path):
    import cv2
    from ultralytics import YOLO
    import numpy as np
    cap = cv2.VideoCapture(str(path))
    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        if not cap.isOpened() or fps <= 0:
            raise ValueError('영상을 읽을 수 없거나 FPS가 올바르지 않습니다.')
        model = YOLO(model_path)
        contours = {p['table_id']: np.array(p['points'], dtype=np.float32) for p in polygons}
        samples, index = [], 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            result = model.track(frame, persist=True, classes=[0], tracker='bytetrack.yaml', verbose=False)[0]
            counts = {key: 0 for key in contours}
            if result.boxes is not None and result.boxes.id is not None:
                for x1, y1, x2, y2 in result.boxes.xyxy.cpu().tolist():
                    center = ((x1+x2)/2, (y1+y2)/2)
                    for key, contour in contours.items():
                        if cv2.pointPolygonTest(contour, center, False) >= 0:
                            counts[key] += 1
                            break
            samples.append((index/fps, counts))
            index += 1
        if not samples:
            raise ValueError('디코딩 가능한 프레임이 없습니다.')
        return aggregate(samples, list(contours), index/fps)
    finally:
        cap.release()

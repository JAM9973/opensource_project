"""YOLO person tracking and incremental video-time statistics."""
import math


class Statistics:
    def __init__(self, tables, gap=3.0, bucket=60):
        self.tables = list(tables)
        if not self.tables or gap < 0 or bucket <= 0:
            raise ValueError('Invalid statistics settings')
        self.gap, self.bucket = gap, bucket
        self.active, self.bins, self.sessions = {}, {}, []

    def close(self, table):
        start, end, peak = self.active.pop(table)
        self.sessions.append(dict(table_id=table, start_second=start,
            end_second=end, duration_seconds=end-start, peak_people=peak))

    def add(self, second, end, counts):
        for table in self.tables:
            count = counts.get(table, 0)
            if table in self.active and second-self.active[table][1] > self.gap:
                self.close(table)
            if count:
                if table not in self.active:
                    self.active[table] = [second, end, count]
                self.active[table][1] = end
                self.active[table][2] = max(count, self.active[table][2])
        cursor = second
        while cursor < end:
            index = int(cursor//self.bucket)
            stop = min(end, (index+1)*self.bucket)
            weight = stop-cursor
            row = self.bins.setdefault(index, [0., 0., 0.])
            row[0] += weight
            row[1] += sum(counts.values())*weight
            row[2] += sum(counts.get(t, 0)>0 for t in self.tables)/len(self.tables)*weight
            cursor = stop

    def finish(self, duration):
        for table in list(self.active):
            self.close(table)
        series = [dict(start_second=i*self.bucket, end_second=min((i+1)*self.bucket,duration),
            average_people=v[1]/v[0], occupancy_rate=v[2]/v[0]) for i,v in sorted(self.bins.items())]
        summaries = []
        for table in self.tables:
            rows = [r for r in self.sessions if r['table_id']==table]
            summaries.append(dict(table_id=table, session_count=len(rows),
                average_duration_seconds=sum(r['duration_seconds'] for r in rows)/len(rows) if rows else 0,
                total_occupied_seconds=sum(r['duration_seconds'] for r in rows)))
        return dict(time_series=series, table_sessions=sorted(self.sessions,key=lambda r:r['start_second']),
            table_summary=summaries, duration_seconds=duration)


def aggregate(samples, tables, duration, gap=3.0, bucket=60):
    stats = Statistics(tables,gap,bucket)
    for i,(second,counts) in enumerate(samples):
        end = samples[i+1][0] if i+1<len(samples) else duration
        stats.add(second,end,counts)
    return stats.finish(duration)


def analyze(path, polygons, model_path='yolo11n.pt', progress=None, annotated_path=None, speed_factor=1.0):
    import cv2
    import numpy as np
    from ultralytics import YOLO
    if not math.isfinite(speed_factor) or speed_factor <= 0:
        raise ValueError('speed_factor must be positive')
    cap, writer = cv2.VideoCapture(str(path)), None
    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        width, height = int(cap.get(3)), int(cap.get(4))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if not cap.isOpened() or not math.isfinite(fps) or fps<=0:
            raise ValueError('영상을 열 수 없거나 FPS가 올바르지 않습니다.')
        contours = {p['table_id']:np.array(p['points'],dtype=np.float32) for p in polygons}
        for contour in contours.values():
            if abs(cv2.contourArea(contour))<1 or (contour[:,0]>=width).any() or (contour[:,1]>=height).any() or (contour<0).any():
                raise ValueError('테이블 영역이 영상 크기를 벗어나거나 면적이 없습니다.')
        model = YOLO(model_path)
        stats, index = Statistics(contours), 0
        from .camera import CameraRegistration
        registration = None
        transform = np.eye(3)
        registration_failures = 0
        if annotated_path:
            writer = cv2.VideoWriter(str(annotated_path),cv2.VideoWriter_fourcc(*'mp4v'),fps,(width,height))
            if not writer.isOpened():
                raise ValueError('분석 영상 저장 코덱을 열 수 없습니다.')
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if registration is None:
                registration = CameraRegistration(frame)
            else:
                try:
                    transform = registration.match(frame)
                    registration_failures = 0
                except ValueError:
                    registration_failures += 1
                    if registration_failures > 15:
                        raise ValueError('카메라 좌표 보정 실패: 구도가 고정된 영상이나 구간별 분석이 필요합니다.')
            result = model.track(frame,persist=True,classes=[0],tracker='bytetrack.yaml',verbose=False)[0]
            counts = {key:0 for key in contours}
            if result.boxes is not None:
                # Count detections even during tracker warm-up, when IDs may be absent.
                for x1,y1,x2,y2 in result.boxes.xyxy.cpu().tolist():
                    reference_center = cv2.perspectiveTransform(np.float32([[[(x1+x2)/2,(y1+y2)/2]]]),transform)[0,0]
                    for key,contour in contours.items():
                        if cv2.pointPolygonTest(contour,tuple(map(float,reference_center)),False)>=0:
                            counts[key]+=1
                            break
            stats.add(index/fps*speed_factor,(index+1)/fps*speed_factor,counts)
            index+=1
            if writer:
                image = result.plot()
                for key,contour in contours.items():
                    current_contour = cv2.perspectiveTransform(contour.reshape(-1,1,2),np.linalg.inv(transform)).reshape(-1,2)
                    cv2.polylines(image,[current_contour.astype(np.int32)],True,(255,160,0),2)
                    x,y = current_contour[0].astype(int)
                    cv2.putText(image,f'{key}: {counts[key]}',(x,y),cv2.FONT_HERSHEY_SIMPLEX,.6,(255,160,0),2)
                writer.write(image)
            if progress and (index%30==0 or index==total):
                progress(index,total)
        if not index:
            raise ValueError('디코딩 가능한 프레임이 없습니다.')
        output = stats.finish(index/fps*speed_factor)
        output['time_basis'] = dict(basis='video_playback' if speed_factor==1 else 'speed_adjusted', unit='seconds', speed_factor=speed_factor, video_duration_seconds=index/fps)
        output['video'] = dict(width=width,height=height,fps=fps,processed_frames=index)
        return output
    finally:
        cap.release()
        if writer:
            writer.release()

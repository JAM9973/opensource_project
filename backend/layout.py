"""Multi-frame table/chair proposals, editable camera profiles, profile reuse."""
import base64
import json
from pathlib import Path
import cv2
import numpy as np
from .camera import CameraRegistration, transform_points


def first_frame(video):
    cap = cv2.VideoCapture(str(video))
    try:
        ok,frame = cap.read()
        if not ok:
            raise ValueError('영상 첫 프레임을 읽을 수 없습니다.')
        return frame
    finally:
        cap.release()


def make_profile(frame,tables,**metadata):
    ok,encoded = cv2.imencode('.jpg',frame)
    if not ok:
        raise ValueError('기준 프레임 저장 실패')
    return dict(version=1,width=frame.shape[1],height=frame.shape[0],
        reference_image=base64.b64encode(encoded.tobytes()).decode(),tables=tables,
        time_basis='video_seconds',**metadata)


def profile_frame(profile):
    frame = cv2.imdecode(np.frombuffer(base64.b64decode(profile['reference_image']),np.uint8),cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError('저장된 기준 영상이 손상되었습니다.')
    return frame


def save_profile(path,profile):
    from .main import validate_tables
    validate_tables(json.dumps(profile['tables']))
    path = Path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary = path.with_suffix(path.suffix+'.tmp')
    temporary.write_text(json.dumps(profile,ensure_ascii=False),encoding='utf-8')
    temporary.replace(path)


def reuse_profile(profile,frame):
    from .main import validate_tables
    validate_tables(json.dumps(profile['tables']))
    h = CameraRegistration(profile_frame(profile)).match(frame)
    tables = []
    for table in profile['tables']:
        points = transform_points(table['points'],np.linalg.inv(h))
        if (points[:,0]<-2).any() or (points[:,1]<-2).any() or (points[:,0]>frame.shape[1]+1).any() or (points[:,1]>frame.shape[0]+1).any():
            raise ValueError('저장 영역 일부가 화면 밖입니다. 영역을 다시 생성·확인하세요.')
        points=np.clip(points,[0,0],[frame.shape[1]-1,frame.shape[0]-1])
        tables.append(dict(table_id=table['table_id'],points=points.tolist()))
    return make_profile(frame,tables,source='reused',reviewed=False)


def iou(a,b):
    low,high = np.maximum(a[:2],b[:2]),np.minimum(a[2:],b[2:])
    area = np.prod(np.maximum(high-low,0))
    return area/max(1.,np.prod(a[2:]-a[:2])+np.prod(b[2:]-b[:2])-area)


def cluster_boxes(observations):
    clusters=[]
    for frame_index,box,confidence in observations:
        candidates=[(iou(np.median(c['boxes'],axis=0),box),c) for c in clusters if frame_index not in c['frames']]
        score,chosen=max(candidates,key=lambda pair:pair[0],default=(0,None))
        if score<.35:
            clusters.append(dict(boxes=[box],frames={frame_index},scores=[confidence]))
        else:
            chosen['boxes'].append(box);chosen['frames'].add(frame_index);chosen['scores'].append(confidence)
    return clusters


def auto_layout(video,model_path='yolo11s.pt',sample_count=12):
    from ultralytics import YOLO
    frame = first_frame(video)
    registration = CameraRegistration(frame)
    model = YOLO(model_path)
    # Read class IDs from the model; do not depend on a specific dataset ordering.
    classes = {name:i for i,name in model.names.items()}
    if not {'dining table','chair'}.issubset(classes):
        raise ValueError('테이블과 의자 클래스가 포함된 모델이 필요합니다.')
    observations={classes['dining table']:[],classes['chair']:[]}
    cap=cv2.VideoCapture(str(video))
    total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    indices=np.unique(np.linspace(0,max(0,total-1),min(sample_count,max(1,total))).astype(int))
    sampled,skipped=0,0
    try:
        for index in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES,int(index));ok,current=cap.read()
            if not ok:
                skipped+=1;continue
            try:
                h=registration.match(current)
            except ValueError:
                skipped+=1;continue
            sampled+=1
            prediction=model.predict(current,classes=list(observations),conf=.2,verbose=False)[0]
            if prediction.boxes is None:
                continue
            for box,category,confidence in zip(prediction.boxes.xyxy.cpu().tolist(),prediction.boxes.cls.cpu().tolist(),prediction.boxes.conf.cpu().tolist()):
                x1,y1,x2,y2=box
                projected=transform_points([[x1,y1],[x2,y1],[x2,y2],[x1,y2]],h)
                mapped=np.r_[projected.min(axis=0),projected.max(axis=0)]
                observations[int(category)].append((int(index),mapped,float(confidence)))
    finally:
        cap.release()
    groups=cluster_boxes(observations[classes['dining table']])
    # A single low-confidence occurrence is retained as a review candidate, never silently discarded.
    groups.sort(key=lambda c:tuple(np.median(c['boxes'],axis=0)[[1,0]]))
    centers=[(np.median(c['boxes'],axis=0)[:2]+np.median(c['boxes'],axis=0)[2:])/2 for c in groups]
    attached=[[] for _ in groups]
    for chair in cluster_boxes(observations[classes['chair']]):
        b=np.median(chair['boxes'],axis=0);center=(b[:2]+b[2:])/2
        distances=[np.linalg.norm(center-c)/max(1.,np.linalg.norm(np.median(g['boxes'],axis=0)[2:]-np.median(g['boxes'],axis=0)[:2])) for c,g in zip(centers,groups)]
        if distances and min(distances)<.8:
            attached[int(np.argmin(distances))].append(b)
    tables=[]
    for i,group in enumerate(groups):
        box=np.median(group['boxes'],axis=0)
        # Table + nearby chair extent proposes a seat zone; users confirm the boundaries.
        all_boxes=[box]+attached[i]
        low=np.min([b[:2] for b in all_boxes],axis=0)
        high=np.max([b[2:] for b in all_boxes],axis=0)
        extent=box[2:]-box[:2]
        low=np.maximum(low,box[:2]-.5*extent)
        high=np.minimum(high,box[2:]+.5*extent)
        padding=(high-low)*.06
        low=np.maximum(low-padding,0);high=np.minimum(high+padding,[frame.shape[1]-1,frame.shape[0]-1])
        if (high-low<5).any():
            continue
        x1,y1=map(float,low);x2,y2=map(float,high)
        tables.append(dict(table_id=f'T{len(tables)+1}',points=[[x1,y1],[x2,y1],[x2,y2],[x1,y2]],
            detected_frames=len(group['frames']),chair_candidates=len(attached[i]),confidence=float(np.mean(group['scores']))))
    return make_profile(frame,tables,source='automatic',reviewed=False,sampled_frames=sampled,skipped_frames=skipped)


def tables_for_video(path,video):
    value=json.loads(Path(path).read_text(encoding='utf-8-sig'))
    if isinstance(value,list):
        return value
    return reuse_profile(value,first_frame(video))['tables']

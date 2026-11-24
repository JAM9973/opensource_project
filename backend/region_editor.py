"""Native polygon editor. Drag vertices; N adds; Enter confirms; D deletes; S saves."""
import argparse
import copy
import json
from pathlib import Path
import cv2
import numpy as np
from .camera import CameraRegistration,transform_points
from .layout import auto_layout,first_frame,profile_frame,reuse_profile,save_profile


class Editor:
    def __init__(self,profile):
        self.profile=copy.deepcopy(profile)
        self.frame=profile_frame(profile)
        self.tables=self.profile['tables']
        self.selected=0 if self.tables else None
        self.drag=None;self.adding=False;self.pending=[]
        self.scale=min(1.,1280/self.frame.shape[1],800/self.frame.shape[0])
        self.transform=np.eye(3)
        self.reference=CameraRegistration(self.frame)
        self.error=''
        self.history=[]

    def remember(self):
        self.history.append(copy.deepcopy(self.tables))

    def mouse(self,event,x,y,flags=0,param=None):
        if y >= self.frame.shape[0]*self.scale and event==cv2.EVENT_LBUTTONDOWN:
            return
        raw=np.float32([[x/self.scale,y/self.scale]])
        point=transform_points(raw,self.transform)[0]
        point=np.clip(point,[0,0],[self.profile['width']-1,self.profile['height']-1]).tolist()
        if event==cv2.EVENT_LBUTTONDOWN:
            if self.adding:
                self.pending.append(point);return
            candidates=[]
            for i,t in enumerate(self.tables):
                projected=transform_points(t['points'],np.linalg.inv(self.transform))*self.scale
                for j,p in enumerate(projected):
                    candidates.append((float(np.linalg.norm(p-[x,y])),i,j))
            if candidates and min(candidates)[0]<=14:
                _,self.selected,j=min(candidates)
                self.remember();self.drag=(self.selected,j)
            else:
                self.selected=None
                for i,t in reversed(list(enumerate(self.tables))):
                    if cv2.pointPolygonTest(np.float32(t['points']),tuple(point),False)>=0:
                        self.selected=i;break
        elif event==cv2.EVENT_MOUSEMOVE and self.drag is not None:
            i,j=self.drag;self.tables[i]['points'][j]=point
        elif event==cv2.EVENT_LBUTTONUP:
            self.drag=None

    def key(self,key,path):
        self.error=''
        if key==ord('n'):
            self.adding=True;self.pending=[]
        elif key in (10,13) and self.adding and len(self.pending)>=3:
            self.remember()
            used={t['table_id'] for t in self.tables};i=1
            while f'T{i}' in used:i+=1
            self.tables.append(dict(table_id=f'T{i}',points=copy.deepcopy(self.pending)))
            self.selected=len(self.tables)-1;self.pending=[];self.adding=False
        elif key in (ord('d'),127,3014656) and self.selected is not None and not self.adding:
            self.remember();self.tables.pop(self.selected);self.selected=None
        elif key==ord('u') and self.history:
            self.tables[:]=self.history.pop();self.selected=None;self.drag=None
        elif key==27:
            self.adding=False;self.pending=[];self.drag=None
        elif key==ord('s'):
            try:
                self.profile['reviewed']=True
                save_profile(path,self.profile)
                return 'saved'
            except ValueError as error:
                self.error=str(error)
        return None

    def render(self):
        image=self.frame.copy()
        for i,t in enumerate(self.tables):
            points=transform_points(t['points'],np.linalg.inv(self.transform)).astype(np.int32)
            color=(255,160,0) if i==self.selected else (230,230,230)
            cv2.polylines(image,[points],True,color,2)
            for p in points:cv2.circle(image,tuple(p),6,color,-1)
            x,y=points[0]
            cv2.putText(image,t['table_id'],(max(0,x),max(20,y)),cv2.FONT_HERSHEY_SIMPLEX,.7,color,2)
        if self.pending:
            points=transform_points(self.pending,np.linalg.inv(self.transform)).astype(np.int32)
            cv2.polylines(image,[points],False,(255,160,0),2)
            for p in points:cv2.circle(image,tuple(p),6,(255,160,0),-1)
        image=cv2.resize(image,None,fx=self.scale,fy=self.scale)
        bar=np.zeros((65,image.shape[1],3),np.uint8)
        cv2.putText(bar,'N add | Enter confirm | D delete | U undo | S save | Esc cancel | Q quit',(8,22),cv2.FONT_HERSHEY_SIMPLEX,.45,(255,255,255),1)
        cv2.putText(bar,f'{len(self.tables)} regions | drag vertices | video seconds | '+('ADDING' if self.adding else 'select region'),(8,45),cv2.FONT_HERSHEY_SIMPLEX,.45,(255,255,255),1)
        if self.error:print(self.error);self.error=''
        return np.vstack([image,bar])


def edit(profile,video,path):
    editor=Editor(profile)
    window='Seat regions'
    cap=cv2.VideoCapture(str(video));total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cv2.namedWindow(window,cv2.WINDOW_AUTOSIZE)
    cv2.setMouseCallback(window,editor.mouse)
    def seek(index):
        cap.set(cv2.CAP_PROP_POS_FRAMES,index);ok,frame=cap.read()
        if ok:
            try:
                h=editor.reference.match(frame)
                editor.frame=frame;editor.transform=h
            except ValueError as error:
                editor.error=str(error)
    cv2.createTrackbar('Frame',window,0,max(1,total-1),seek)
    try:
        while True:
            cv2.imshow(window,editor.render())
            key=cv2.waitKeyEx(30)
            if key==ord('q') or cv2.getWindowProperty(window,cv2.WND_PROP_VISIBLE)<1:
                return False
            if editor.key(key,path)=='saved':
                print('Saved:',Path(path).resolve());return True
    finally:
        cap.release();cv2.destroyAllWindows()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('video')
    parser.add_argument('--profile',default='data/camera_layout.json')
    parser.add_argument('--regenerate',action='store_true')
    parser.add_argument('--generate-only',action='store_true')
    parser.add_argument('--model',default='yolo11s.pt')
    args=parser.parse_args()
    path=Path(args.profile)
    if path.exists() and not args.regenerate:
        profile=reuse_profile(json.loads(path.read_text(encoding='utf-8-sig')),first_frame(args.video))
    else:
        profile=auto_layout(args.video,args.model)
    print('Proposed regions:',len(profile['tables']))
    if args.generate_only:
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(json.dumps(profile,ensure_ascii=False),encoding='utf-8')
    else:
        edit(profile,args.video,path)

if __name__=='__main__':main()

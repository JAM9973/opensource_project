"""Real model smoke test using an official sample photo repeated into a short video.
This verifies decoding/inference/tracking/output, not restaurant accuracy.
"""
import json
from pathlib import Path
from urllib.request import urlretrieve
import cv2
from backend.analysis import analyze

root = Path('data/smoke')
root.mkdir(parents=True,exist_ok=True)
image_path = root/'bus.jpg'
if not image_path.exists():
    urlretrieve('https://raw.githubusercontent.com/ultralytics/ultralytics/main/ultralytics/assets/bus.jpg',image_path)
frame = cv2.imread(str(image_path))
assert frame is not None
h,w = frame.shape[:2]
video = root/'input.mp4'
writer = cv2.VideoWriter(str(video),cv2.VideoWriter_fourcc(*'mp4v'),5,(w,h))
assert writer.isOpened()
for _ in range(10):
    writer.write(frame)
writer.release()
tables = [{'table_id':'T1','points':[[0,0],[w-1,0],[w-1,h-1],[0,h-1]]}]
result = analyze(video,tables,annotated_path=root/'annotated.mp4')
assert result['video']['processed_frames']==10
assert result['duration_seconds']==2
assert result['time_series'][0]['average_people']>0
assert result['table_sessions'][0]['duration_seconds']==2
assert (root/'annotated.mp4').stat().st_size>0
(root/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))

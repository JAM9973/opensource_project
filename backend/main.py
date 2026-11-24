import json
import logging
import os
import threading
from pathlib import Path
from uuid import uuid4
from pydantic import BaseModel, Field, ValidationError, field_validator

from dotenv import load_dotenv
from fastapi import FastAPI, BackgroundTasks, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .analysis import analyze

load_dotenv()
app = FastAPI(title='식당 테이블 영상 분석 API')
app.add_middleware(CORSMiddleware, allow_origins=os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(','),
                   allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])
ROOT = Path(__file__).resolve().parents[1] / 'data'
ROOT.mkdir(exist_ok=True)
jobs = {}
lock = threading.Lock()
admission = threading.BoundedSemaphore(1)


class Table(BaseModel):
    table_id: str = Field(min_length=1, max_length=80)
    points: list[tuple[float, float]] = Field(min_length=3, max_length=100)

    @field_validator('points')
    @classmethod
    def check_points(cls, points):
        import math
        if any(not math.isfinite(v) or v < 0 or v > 100000 for p in points for v in p):
            raise ValueError('Invalid coordinates')
        area = sum(points[i][0]*points[(i+1)%len(points)][1]-points[(i+1)%len(points)][0]*points[i][1] for i in range(len(points)))
        if abs(area)<2:
            raise ValueError('Polygon must have positive area')
        return points


def validate_tables(raw):
    values = json.loads(raw)
    if not isinstance(values, list) or not 1 <= len(values) <= 100:
        raise ValueError('Expected 1 to 100 table polygons')
    tables = [Table.model_validate(v).model_dump() for v in values]
    if len({t['table_id'] for t in tables}) != len(tables):
        raise ValueError('Duplicate table IDs')
    return tables


def run(identifier, path, polygons, speed_factor=1.0):
    with lock:
        jobs[identifier]['status'] = 'processing'
        try:
            def progress(n, total):
                jobs[identifier]['processed_frames'] = n
                jobs[identifier]['total_frames'] = total
            result = analyze(path, polygons, os.getenv('MODEL_PATH', 'yolo11n.pt'), progress=progress, speed_factor=speed_factor)
            jobs[identifier].update(result=result, status='completed', storage='local')
            url, key = os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SECRET_KEY')
            if url and key:
                try:
                    from supabase import create_client
                    db = create_client(url, key)
                    db.table('analyses').upsert({'id': identifier, 'result': result}).execute()
                    jobs[identifier]['storage'] = 'supabase'
                except Exception:
                    logging.exception('Supabase storage failed')
                    jobs[identifier]['storage_error'] = 'Supabase 저장 실패. 로컬 결과는 보관됩니다.'
        except Exception:
            logging.exception('Analysis %s failed', identifier)
            jobs[identifier]['status'] = 'failed'
            jobs[identifier]['error'] = '분석 또는 저장 실패. 서버 로그를 확인하세요.'
        finally:
            try:
                (ROOT / (identifier+'.json')).write_text(json.dumps(jobs[identifier], ensure_ascii=False), encoding='utf-8')
            finally:
                try:
                    path.unlink(missing_ok=True)
                finally:
                    admission.release()


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/api/analyses', status_code=202)
async def create(background: BackgroundTasks, video: UploadFile = File(...), tables: str = Form(...), speed_factor: float = Form(1.0, gt=0, le=10000)):
    try:
        profile = json.loads(tables)
        polygons = validate_tables(json.dumps(profile['tables']) if isinstance(profile, dict) else tables)
    except (ValueError, TypeError, KeyError, ValidationError):
        raise HTTPException(422, 'tables는 고유 table_id와 3개 이상의 픽셀 좌표 points를 가진 JSON 배열이어야 합니다.')
    if not admission.acquire(blocking=False):
        raise HTTPException(409, '다른 영상을 분석 중입니다.')
    identifier = str(uuid4())
    path = ROOT / (identifier+'.video')
    try:
        size = 0
        with path.open('wb') as out:
            while chunk := await video.read(1024*1024):
                size += len(chunk)
                if size > 200*1024*1024:
                    raise HTTPException(413, '영상은 200MB 이하여야 합니다.')
                out.write(chunk)
        if not size:
            raise HTTPException(422, '빈 영상입니다.')
        if isinstance(profile, dict):
            from .layout import first_frame, reuse_profile
            try:
                polygons = validate_tables(json.dumps(reuse_profile(profile, first_frame(path))['tables']))
            except (ValueError, KeyError, TypeError):
                raise HTTPException(422, '저장된 카메라 영역을 영상에 적용할 수 없습니다. 구도를 확인하세요.')
    except Exception:
        path.unlink(missing_ok=True)
        admission.release()
        raise
    finally:
        await video.close()
    jobs[identifier] = {'id': identifier, 'status': 'queued'}
    background.add_task(run, identifier, path, polygons, speed_factor)
    return jobs[identifier].copy()


@app.post('/api/layouts')
def propose_layout(video: UploadFile = File(...)):
    """Returns an editable profile; browser/editor posts the edited profile as tables."""
    from .layout import auto_layout
    if not admission.acquire(blocking=False):
        raise HTTPException(409, '다른 영상을 처리 중입니다.')
    path = ROOT / (str(uuid4())+'.video')
    try:
        size = 0
        with path.open('wb') as out:
            while chunk := video.file.read(1024*1024):
                size += len(chunk)
                if size > 200*1024*1024:
                    raise HTTPException(413, '영상은 200MB 이하여야 합니다.')
                out.write(chunk)
        if not size:
            raise HTTPException(422, '빈 영상입니다.')
        return auto_layout(path, os.getenv('LAYOUT_MODEL_PATH','yolo11s.pt'))
    except ValueError as error:
        raise HTTPException(422, str(error))
    finally:
        try:
            video.file.close()
            path.unlink(missing_ok=True)
        finally:
            admission.release()


@app.get('/api/analyses/{identifier}')
def get(identifier: str):
    try:
        from uuid import UUID
        identifier = str(UUID(identifier))
    except ValueError:
        raise HTTPException(404, '분석이 없습니다.')
    if identifier in jobs:
        return jobs[identifier].copy()
    saved = ROOT / (identifier+'.json')
    if saved.exists():
        return json.loads(saved.read_text(encoding='utf-8'))
    raise HTTPException(404, '분석이 없습니다.')

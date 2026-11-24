import json
import logging
import os
import threading
from pathlib import Path
from uuid import uuid4

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


def run(identifier, path, polygons):
    with lock:
        jobs[identifier]['status'] = 'processing'
        try:
            result = analyze(path, polygons, os.getenv('MODEL_PATH', 'yolo11n.pt'))
            jobs[identifier].update(result=result, status='completed', storage='local')
            url, key = os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SECRET_KEY')
            if url and key:
                from supabase import create_client
                db = create_client(url, key)
                db.table('analyses').upsert({'id': identifier, 'result': result}).execute()
                jobs[identifier]['storage'] = 'supabase'
        except Exception:
            logging.exception('Analysis %s failed', identifier)
            jobs[identifier]['status'] = 'failed'
            jobs[identifier]['error'] = '분석 또는 저장 실패. 서버 로그를 확인하세요.'
        finally:
            (ROOT / (identifier+'.json')).write_text(json.dumps(jobs[identifier], ensure_ascii=False), encoding='utf-8')
            path.unlink(missing_ok=True)


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/api/analyses', status_code=202)
async def create(background: BackgroundTasks, video: UploadFile = File(...), tables: str = Form(...)):
    try:
        polygons = json.loads(tables)
        assert isinstance(polygons, list) and polygons
        ids = set()
        for p in polygons:
            assert isinstance(p['table_id'], str) and p['table_id'] and p['table_id'] not in ids
            ids.add(p['table_id'])
            assert len(p['points']) >= 3
            for point in p['points']:
                assert len(point) == 2 and all(type(v) in (int, float) and 0 <= v <= 100000 for v in point)
    except (ValueError, TypeError, KeyError, AssertionError):
        raise HTTPException(422, 'tables는 고유 table_id와 3개 이상의 픽셀 좌표 points를 가진 JSON 배열이어야 합니다.')
    if not lock.acquire(blocking=False):
        raise HTTPException(409, '다른 영상을 분석 중입니다.')
    lock.release()
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
    except Exception:
        path.unlink(missing_ok=True)
        raise
    finally:
        await video.close()
    jobs[identifier] = {'id': identifier, 'status': 'queued'}
    background.add_task(run, identifier, path, polygons)
    return jobs[identifier].copy()


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

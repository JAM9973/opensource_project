import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import asyncio
import httpx

class TestClient:
    def __init__(self, app):
        self.app = app
    def request(self, method, url, **kwargs):
        async def send():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app),base_url="http://test") as client:
                return await client.request(method,url,**kwargs)
        return asyncio.run(send())
    def post(self,url,**kwargs):
        return self.request("POST",url,**kwargs)
    def get(self,url,**kwargs):
        return self.request("GET",url,**kwargs)
from backend import main


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.patcher = patch.object(main, 'ROOT', Path(self.temp.name))
        self.patcher.start()
        self.client = TestClient(main.app)
        self.tables = json.dumps([{'table_id':'T1','points':[[0,0],[100,0],[100,100]]}])

    def tearDown(self):
        self.patcher.stop()
        self.temp.cleanup()
        main.jobs.clear()

    def test_upload_status_and_persisted_result(self):
        with patch.object(main,'analyze',return_value={'time_series':[],'table_sessions':[]}), patch.dict(main.os.environ,{'SUPABASE_URL':''}):
            response = self.client.post('/api/analyses',data={'tables':self.tables},files={'video':('a.mp4',b'video')})
        self.assertEqual(response.status_code,202)
        identifier = response.json()['id']
        self.assertEqual(self.client.get('/api/analyses/'+identifier).json()['status'],'completed')
        main.jobs.clear()
        self.assertEqual(self.client.get('/api/analyses/'+identifier).json()['storage'],'local')

    def test_bad_polygons_and_empty_upload(self):
        for raw in ['null','{}','[null]','[]',self.tables.replace('100','NaN')]:
            self.assertEqual(self.client.post('/api/analyses',data={'tables':raw},files={'video':('a',b'x')}).status_code,422)
        self.assertEqual(self.client.post('/api/analyses',data={'tables':self.tables},files={'video':('a',b'')}).status_code,422)

    def test_failed_analysis_releases_slot(self):
        with patch.object(main,'analyze',side_effect=ValueError('Invalid video')):
            response = self.client.post('/api/analyses',data={'tables':self.tables},files={'video':('a',b'x')})
        self.assertEqual(self.client.get('/api/analyses/'+response.json()['id']).json()['status'],'failed')
        self.assertTrue(main.admission.acquire(blocking=False))
        main.admission.release()

    def test_speed_factor_forwarded_and_invalid_speed_rejected(self):
        with patch.object(main,'analyze',return_value={}) as model, patch.dict(main.os.environ,{'SUPABASE_URL':''}):
            response = self.client.post('/api/analyses',data={'tables':self.tables,'speed_factor':'4'},files={'video':('a',b'x')})
            self.assertEqual(response.status_code,202)
            self.assertEqual(model.call_args.kwargs['speed_factor'],4)
        self.assertEqual(self.client.post('/api/analyses',data={'tables':self.tables,'speed_factor':'0'},files={'video':('a',b'x')}).status_code,422)

    def test_concurrent_upload_rejected(self):
        main.admission.acquire()
        try:
            response = self.client.post('/api/analyses',data={'tables':self.tables},files={'video':('a',b'x')})
            self.assertEqual(response.status_code,409)
        finally:
            main.admission.release()

    def test_automatic_layout_and_edited_profile_reach_analysis(self):
        from backend import layout
        profile={'tables':json.loads(self.tables),'reference_image':'test'}
        with patch.object(layout,'auto_layout',return_value=profile):
            response=self.client.post('/api/layouts',files={'video':('a',b'x')})
            self.assertEqual(response.status_code,200)
        profile['tables'][0]['points'][0]=[5,5]
        with patch.object(layout,'first_frame',return_value=None),patch.object(layout,'reuse_profile',return_value=profile),patch.object(main,'analyze',return_value={}) as model,patch.dict(main.os.environ,{'SUPABASE_URL':''}):
            response=self.client.post('/api/analyses',data={'tables':json.dumps(profile)},files={'video':('a',b'x')})
            self.assertEqual(response.status_code,202)
            self.assertEqual(model.call_args.args[1][0]['points'][0],(5,5))

if __name__ == '__main__':
    unittest.main()

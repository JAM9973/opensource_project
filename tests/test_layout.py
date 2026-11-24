import json
from pathlib import Path
import tempfile
import unittest
import cv2
import numpy as np
from backend.layout import make_profile,save_profile,reuse_profile,cluster_boxes,profile_frame
from backend.region_editor import Editor

class LayoutTests(unittest.TestCase):
    def setUp(self):
        self.frame=np.random.default_rng(42).integers(0,256,(320,480,3),dtype=np.uint8)
        self.tables=[{'table_id':'T1','points':[[50,50],[200,50],[200,200],[50,200]]}]
        self.profile=make_profile(self.frame,self.tables)

    def test_edit_add_delete_save_and_reuse(self):
        editor=Editor(self.profile)
        editor.mouse(cv2.EVENT_LBUTTONDOWN,50,50)
        editor.mouse(cv2.EVENT_MOUSEMOVE,60,65)
        editor.mouse(cv2.EVENT_LBUTTONUP,60,65)
        self.assertEqual(editor.tables[0]['points'][0],[60,65])
        editor.key(ord('n'),'unused')
        for x,y in [(260,50),(400,50),(400,200),(260,200)]:
            editor.mouse(cv2.EVENT_LBUTTONDOWN,x,y)
        editor.key(13,'unused')
        self.assertEqual(len(editor.tables),2)
        editor.key(ord('d'),'unused')
        self.assertEqual(len(editor.tables),1)
        editor.key(ord('u'),'unused')
        self.assertEqual(len(editor.tables),2)
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'camera.json'
            self.assertEqual(editor.key(ord('s'),path),'saved')
            saved=json.loads(path.read_text())
            reused=reuse_profile(saved,profile_frame(saved))
            self.assertEqual(len(reused['tables']),2)
            self.assertEqual(reused['time_basis'],'video_seconds')

    def test_different_camera_is_rejected(self):
        with self.assertRaises(ValueError):
            reuse_profile(self.profile,np.zeros_like(self.frame))

    def test_empty_detection_allows_manual_region(self):
        editor=Editor(make_profile(self.frame,[]))
        editor.key(ord('n'),'unused')
        for x,y in [(20,20),(100,20),(100,100)]:editor.mouse(cv2.EVENT_LBUTTONDOWN,x,y)
        editor.key(13,'unused')
        self.assertEqual(len(editor.tables),1)

    def test_cluster_does_not_merge_two_detections_in_same_frame(self):
        box=np.array([0,0,100,100],dtype=float)
        clusters=cluster_boxes([(0,box,.8),(0,box,.8),(1,box,.9)])
        self.assertEqual(len(clusters),2)
        self.assertEqual(max(len(c['frames']) for c in clusters),2)

    def test_invalid_drag_cannot_be_saved(self):
        profile=make_profile(self.frame,[{'table_id':'T1','points':[[10,10],[20,20],[30,30]]}])
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):save_profile(Path(directory)/'invalid.json',profile)

if __name__=='__main__':unittest.main()

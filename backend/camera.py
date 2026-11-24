"""Map a current frame to a saved camera reference using ORB/RANSAC."""
import cv2
import numpy as np

class CameraRegistration:
    def __init__(self, reference):
        self.orb = cv2.ORB_create(nfeatures=2500)
        self.points,self.descriptors = self.orb.detectAndCompute(cv2.cvtColor(reference,cv2.COLOR_BGR2GRAY),None)
        self.reference = reference

    def match(self, frame):
        if frame.shape==self.reference.shape and np.array_equal(frame,self.reference):
            return np.eye(3)
        points,descriptors = self.orb.detectAndCompute(cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY),None)
        if descriptors is None or self.descriptors is None:
            raise ValueError('카메라 구도 일치 확인 실패: 배경 특징 부족')
        pairs = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(descriptors,self.descriptors,k=2)
        matches = [p[0] for p in pairs if len(p)==2 and p[0].distance<.7*p[1].distance]
        if len(matches)<12:
            raise ValueError('카메라 구도 일치 확인 실패: 특징점 부족')
        src = np.float32([points[m.queryIdx].pt for m in matches])
        dst = np.float32([self.points[m.trainIdx].pt for m in matches])
        h,mask = cv2.findHomography(src,dst,cv2.RANSAC,3.)
        if h is None or mask is None or mask.sum()<12 or mask.mean()<.25 or not np.isfinite(h).all() or abs(np.linalg.det(h))<1e-8:
            raise ValueError('카메라 구도 일치 확인 실패: 다른 구도이거나 장면 전환')
        if cv2.contourArea(cv2.convexHull(dst[mask.ravel().astype(bool)])) < self.reference.shape[0]*self.reference.shape[1]*.015:
            raise ValueError('카메라 구도 일치 확인 실패: 특징점이 한 곳에 집중됨')
        return h


def transform_points(points,h):
    return cv2.perspectiveTransform(np.float32(points).reshape(-1,1,2),h).reshape(-1,2)

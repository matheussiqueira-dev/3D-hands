from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple
import os
import time
import urllib.request

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

from core.config import AppConfig


@dataclass
class HandDetection:
    landmarks: object
    bbox: Tuple[int, int, int, int]
    handedness: str


@dataclass
class _LegacyLandmark:
    x: float
    y: float
    z: float


@dataclass
class _LegacyLandmarkList:
    landmark: List[_LegacyLandmark]


class HandTracker:
    DEFAULT_MODEL_URL = (
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
        "hand_landmarker/float16/1/hand_landmarker.task"
    )
    DEFAULT_MODEL_PATH = Path("models/mediapipe/hand_landmarker.task")

    def __init__(self, config: AppConfig) -> None:
        self.config = config
        self._last_ts_ms = 0

        model_path = self._resolve_model_path()
        self._ensure_model_exists(model_path)

        options = mp_vision.HandLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=str(model_path)),
            running_mode=mp_vision.RunningMode.VIDEO,
            num_hands=config.max_hands,
            min_hand_detection_confidence=config.detection_confidence,
            min_hand_presence_confidence=config.detection_confidence,
            min_tracking_confidence=config.tracking_confidence,
        )
        self._hands = mp_vision.HandLandmarker.create_from_options(options)

    def process(self, frame) -> List[HandDetection]:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        timestamp_ms = self._next_timestamp_ms()
        results = self._hands.detect_for_video(mp_image, timestamp_ms)
        detections: List[HandDetection] = []

        if not results.hand_landmarks:
            return detections

        h, w = frame.shape[:2]
        handedness_data = results.handedness or []

        for idx, hand_landmarks in enumerate(results.hand_landmarks):
            handedness = "Unknown"
            if idx < len(handedness_data) and handedness_data[idx]:
                handedness = handedness_data[idx][0].category_name or "Unknown"

            legacy_landmarks = _LegacyLandmarkList(
                landmark=[
                    _LegacyLandmark(x=lm.x, y=lm.y, z=lm.z)
                    for lm in hand_landmarks
                ]
            )

            bbox = self._compute_bbox(legacy_landmarks, w, h)
            detections.append(
                HandDetection(
                    landmarks=legacy_landmarks,
                    bbox=bbox,
                    handedness=handedness,
                )
            )

        return detections

    def _resolve_model_path(self) -> Path:
        configured = os.getenv("GESTURE_HAND_MODEL_PATH", "").strip()
        if configured:
            return Path(configured)
        return self.DEFAULT_MODEL_PATH

    def _ensure_model_exists(self, model_path: Path) -> None:
        if model_path.exists():
            return

        if os.getenv("GESTURE_HAND_MODEL_PATH", "").strip():
            raise FileNotFoundError(f"Modelo de mao nao encontrado: {model_path}")

        model_path.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(self.DEFAULT_MODEL_URL, str(model_path))

    def _next_timestamp_ms(self) -> int:
        ts = int(time.monotonic() * 1000)
        if ts <= self._last_ts_ms:
            ts = self._last_ts_ms + 1
        self._last_ts_ms = ts
        return ts

    @staticmethod
    def _compute_bbox(hand_landmarks, width: int, height: int) -> Tuple[int, int, int, int]:
        xs = [int(lm.x * width) for lm in hand_landmarks.landmark]
        ys = [int(lm.y * height) for lm in hand_landmarks.landmark]
        x_min = max(min(xs) - 12, 0)
        y_min = max(min(ys) - 12, 0)
        x_max = min(max(xs) + 12, width - 1)
        y_max = min(max(ys) + 12, height - 1)
        return x_min, y_min, x_max, y_max

    def close(self) -> None:
        if self._hands is not None:
            self._hands.close()

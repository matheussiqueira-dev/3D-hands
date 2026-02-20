from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Tuple

from core.constants import DEFAULT_DATASET_PATH, DEFAULT_LOG_PATH, DEFAULT_MODEL_PATH


@dataclass
class AppConfig:
    camera_index: int = 0
    frame_width: int = 1280
    frame_height: int = 720
    target_fps: int = 30
    queue_size: int = 4
    reduce_resolution_scale: float = 1.0

    max_hands: int = 1
    detection_confidence: float = 0.6
    tracking_confidence: float = 0.5

    prediction_threshold: float = 0.8
    smoothing_window: int = 5
    model_auto_reload_sec: float = 1.0

    training_samples: int = 200
    test_size: float = 0.2
    random_state: int = 42
    classifier_type: str = "random_forest"

    debug_mode: bool = False

    render_width: int = 960
    render_height: int = 720
    dominant_hand: str = "Right"
    deadzone_px: float = 8.0
    translation_sensitivity: float = 0.004
    rotation_sensitivity: float = 0.45
    depth_sensitivity: float = 1.2
    pinch_scale_sensitivity: float = 2.2
    two_hand_scale_sensitivity: float = 0.004
    calibration_sec: float = 1.2
    reset_hold_sec: float = 2.0
    swap_hold_sec: float = 1.0
    spin_hold_sec: float = 0.4
    color_hold_sec: float = 0.6
    pause_cooldown_sec: float = 1.2

    dataset_path: Path = DEFAULT_DATASET_PATH
    model_path: Path = DEFAULT_MODEL_PATH
    log_path: Path = DEFAULT_LOG_PATH

    @classmethod
    def from_env(cls) -> "AppConfig":
        def _int(name: str, default: int) -> int:
            try:
                return int(os.getenv(name, default))
            except (TypeError, ValueError):
                return default

        def _float(name: str, default: float) -> float:
            try:
                return float(os.getenv(name, default))
            except (TypeError, ValueError):
                return default

        def _bool(name: str, default: bool) -> bool:
            value = os.getenv(name)
            if value is None:
                return default
            return value.strip().lower() in {"1", "true", "yes", "on"}

        return cls(
            camera_index=_int("GESTURE_CAMERA_INDEX", 0),
            frame_width=_int("GESTURE_FRAME_WIDTH", 1280),
            frame_height=_int("GESTURE_FRAME_HEIGHT", 720),
            target_fps=max(15, _int("GESTURE_TARGET_FPS", 30)),
            queue_size=max(1, _int("GESTURE_QUEUE_SIZE", 4)),
            reduce_resolution_scale=max(0.2, min(1.0, _float("GESTURE_RESOLUTION_SCALE", 1.0))),
            max_hands=max(1, _int("GESTURE_MAX_HANDS", 1)),
            detection_confidence=max(0.1, min(1.0, _float("GESTURE_DETECTION_CONF", 0.6))),
            tracking_confidence=max(0.1, min(1.0, _float("GESTURE_TRACKING_CONF", 0.5))),
            prediction_threshold=max(0.0, min(1.0, _float("GESTURE_PREDICTION_THRESHOLD", 0.8))),
            smoothing_window=max(1, _int("GESTURE_SMOOTHING_WINDOW", 5)),
            model_auto_reload_sec=max(0.1, _float("GESTURE_MODEL_RELOAD_SEC", 1.0)),
            training_samples=max(20, _int("GESTURE_TRAIN_SAMPLES", 200)),
            test_size=max(0.05, min(0.4, _float("GESTURE_TEST_SIZE", 0.2))),
            random_state=_int("GESTURE_RANDOM_STATE", 42),
            classifier_type=os.getenv("GESTURE_CLASSIFIER", "random_forest").strip().lower(),
            debug_mode=_bool("GESTURE_DEBUG", False),
            render_width=_int("GESTURE_RENDER_WIDTH", 960),
            render_height=_int("GESTURE_RENDER_HEIGHT", 720),
            dominant_hand=os.getenv("GESTURE_DOMINANT_HAND", "Right").strip().capitalize(),
            deadzone_px=max(1.0, _float("GESTURE_DEADZONE_PX", 8.0)),
            translation_sensitivity=_float("GESTURE_TRANSLATION_SENS", 0.004),
            rotation_sensitivity=_float("GESTURE_ROTATION_SENS", 0.45),
            depth_sensitivity=_float("GESTURE_DEPTH_SENS", 1.2),
            pinch_scale_sensitivity=_float("GESTURE_PINCH_SCALE_SENS", 2.2),
            two_hand_scale_sensitivity=_float("GESTURE_TWO_HAND_SCALE_SENS", 0.004),
            calibration_sec=max(0.4, _float("GESTURE_CALIBRATION_SEC", 1.2)),
            reset_hold_sec=max(0.6, _float("GESTURE_RESET_HOLD_SEC", 2.0)),
            swap_hold_sec=max(0.3, _float("GESTURE_SWAP_HOLD_SEC", 1.0)),
            spin_hold_sec=max(0.2, _float("GESTURE_SPIN_HOLD_SEC", 0.4)),
            color_hold_sec=max(0.2, _float("GESTURE_COLOR_HOLD_SEC", 0.6)),
            pause_cooldown_sec=max(0.4, _float("GESTURE_PAUSE_COOLDOWN_SEC", 1.2)),
            dataset_path=Path(os.getenv("GESTURE_DATASET_PATH", str(DEFAULT_DATASET_PATH))),
            model_path=Path(os.getenv("GESTURE_MODEL_PATH", str(DEFAULT_MODEL_PATH))),
            log_path=Path(os.getenv("GESTURE_LOG_PATH", str(DEFAULT_LOG_PATH))),
        )

    @property
    def resolution(self) -> Tuple[int, int]:
        scaled_w = int(self.frame_width * self.reduce_resolution_scale)
        scaled_h = int(self.frame_height * self.reduce_resolution_scale)
        return max(320, scaled_w), max(240, scaled_h)

    def ensure_paths(self) -> None:
        self.dataset_path.parent.mkdir(parents=True, exist_ok=True)
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        self.log_path.parent.mkdir(parents=True, exist_ok=True)

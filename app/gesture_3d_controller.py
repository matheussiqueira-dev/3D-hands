from __future__ import annotations

import logging
import time
from typing import List, Optional, Tuple

import cv2
import numpy as np

from core.config import AppConfig
from core.constants import KEY_ESC, WINDOW_NAME_3D
from gestures.gesture_recognizer import GestureRecognizer, HandState
from interaction.floating_object import FloatingObject
from ui.renderer_3d import Renderer3D
from ui.renderer_debug import DebugRenderer
from utils.fps_counter import FPSCounter
from vision.camera import CameraError, ThreadedCamera
from vision.hand_tracker import HandDetection, HandTracker
from vision.landmark_processor import LandmarkProcessor


class Gesture3DController:
    def __init__(
        self,
        config: Optional[AppConfig] = None,
        logger: Optional[logging.Logger] = None,
        simple_mode: bool = False,
    ) -> None:
        self.config = config or AppConfig.from_env()
        self.logger = logger or logging.getLogger("gesture_3d")
        self.simple_mode = simple_mode

        if not self.simple_mode and self.config.max_hands < 2:
            self.config.max_hands = 2

        self.camera = ThreadedCamera(self.config)
        self.hand_tracker = HandTracker(self.config)
        self.landmark_processor = LandmarkProcessor()
        self.gesture_recognizer = GestureRecognizer(self.config, simple_mode=simple_mode)

        self.floating_object = FloatingObject()
        self.renderer_3d = Renderer3D(self.config, WINDOW_NAME_3D)
        self.debug_renderer = DebugRenderer("Gesture Debug")
        self.fps_counter = FPSCounter(window_size=45)

        self._paused = False
        self._last_frame_ts = time.perf_counter()
        self._spin_speed = 60.0

    def run(self) -> None:
        self.logger.info("Iniciando gesto 3D | modo=%s", "simples" if self.simple_mode else "avancado")
        try:
            self.camera.start()
        except CameraError:
            self.logger.exception("Falha ao iniciar a camera.")
            self._shutdown()
            return

        self.renderer_3d.start()

        try:
            while True:
                if self.renderer_3d.poll_quit():
                    break

                frame = self.camera.read(timeout=0.1)
                if frame is None:
                    continue

                quit_requested = self._process_frame(frame)
                if quit_requested:
                    break

        except Exception:
            self.logger.exception("Erro inesperado no loop 3D.")
        finally:
            self._shutdown()

    def _process_frame(self, frame) -> bool:
        now = time.perf_counter()
        dt = max(1e-4, now - self._last_frame_ts)
        self._last_frame_ts = now

        detections = self.hand_tracker.process(frame)
        hand_states, hand_bbox, hand_points = self._build_hand_states(frame, detections)

        gesture_output = self.gesture_recognizer.update(hand_states, now=now)

        status = "ok"
        if gesture_output.toggle_pause:
            self._paused = not self._paused
            status = "pausado" if self._paused else "retomado"

        if gesture_output.reset:
            self.floating_object.reset()
            status = "reset"

        if gesture_output.toggle_object:
            self.floating_object.toggle_type()
            status = f"tipo: {self.floating_object.object_type}"

        if gesture_output.toggle_color:
            self.floating_object.toggle_color()
            status = "cor alterada"

        if status == "ok" and gesture_output.calibration_active:
            status = "calibrando"

        if not self._paused:
            self.floating_object.apply_translation(gesture_output.translation)
            self.floating_object.apply_rotation(gesture_output.rotation)
            self.floating_object.apply_scale(gesture_output.scale_delta)

            if gesture_output.spin_active:
                self.floating_object.apply_rotation(np.array([0.0, self._spin_speed * dt, 0.0], dtype=float))

        self.renderer_3d.render(self.floating_object)

        self.fps_counter.tick()
        self.debug_renderer.render(
            frame=frame,
            fps=self.fps_counter.get_fps(),
            gesture_label=gesture_output.gesture_name,
            scale=self.floating_object.scale,
            rotation=(
                float(self.floating_object.rotation_deg[0]),
                float(self.floating_object.rotation_deg[1]),
                float(self.floating_object.rotation_deg[2]),
            ),
            paused=self._paused,
            calibration_active=gesture_output.calibration_active,
            status=status,
            hand_bbox=hand_bbox,
            hand_points=hand_points,
        )

        key = cv2.waitKey(1) & 0xFF
        return key == KEY_ESC

    def _build_hand_states(
        self,
        frame,
        detections: List[HandDetection],
    ) -> Tuple[List[HandState], Optional[Tuple[int, int, int, int]], Optional[np.ndarray]]:
        hand_states: List[HandState] = []
        hand_bbox = None
        hand_points = None

        for detection in detections:
            analysis = self.landmark_processor.process(
                detection.landmarks,
                frame.shape,
                detection.handedness,
            )
            hand_states.append(GestureRecognizer.build_hand_state(analysis, detection.handedness))
            if hand_bbox is None:
                hand_bbox = detection.bbox
                hand_points = analysis.points_px

        return hand_states, hand_bbox, hand_points

    def _shutdown(self) -> None:
        self.camera.stop()
        self.hand_tracker.close()
        self.renderer_3d.close()
        self.debug_renderer.close()

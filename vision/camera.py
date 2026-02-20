from __future__ import annotations

import queue
import threading
import time
from typing import Optional

import cv2

from core.config import AppConfig


class CameraError(RuntimeError):
    pass


class ThreadedCamera:
    def __init__(self, config: AppConfig) -> None:
        self.config = config
        self._capture = cv2.VideoCapture(self.config.camera_index)
        width, height = self.config.resolution
        self._capture.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self._capture.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        self._capture.set(cv2.CAP_PROP_FPS, self.config.target_fps)

        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._queue: queue.Queue = queue.Queue(maxsize=self.config.queue_size)

    def start(self) -> "ThreadedCamera":
        if not self._capture.isOpened():
            raise CameraError(f"Nao foi possivel abrir camera index={self.config.camera_index}")

        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        return self

    def _capture_loop(self) -> None:
        while self._running:
            ok, frame = self._capture.read()
            if not ok:
                time.sleep(0.01)
                continue

            if self._queue.full():
                try:
                    self._queue.get_nowait()
                except queue.Empty:
                    pass

            try:
                self._queue.put_nowait(frame)
            except queue.Full:
                pass

    def read(self, timeout: float = 0.05):
        try:
            return self._queue.get(timeout=timeout)
        except queue.Empty:
            return None

    def stop(self) -> None:
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
        if self._capture.isOpened():
            self._capture.release()

from __future__ import annotations

import time
from collections import deque


class FPSCounter:
    def __init__(self, window_size: int = 30) -> None:
        self._window = deque(maxlen=max(2, window_size))

    def tick(self) -> None:
        self._window.append(time.perf_counter())

    def get_fps(self) -> float:
        if len(self._window) < 2:
            return 0.0
        elapsed = self._window[-1] - self._window[0]
        if elapsed <= 1e-9:
            return 0.0
        return float((len(self._window) - 1) / elapsed)

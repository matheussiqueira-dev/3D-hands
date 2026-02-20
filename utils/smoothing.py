from __future__ import annotations

from collections import deque
from typing import Deque, Tuple


class TemporalSmoother:
    def __init__(self, window_size: int = 5) -> None:
        self.window_size = max(1, window_size)
        self._buffer: Deque[Tuple[str, float]] = deque(maxlen=self.window_size)

    def update(self, label: str, confidence: float) -> Tuple[str, float]:
        self._buffer.append((label, float(confidence)))
        scores: dict[str, float] = {}
        counts: dict[str, int] = {}

        for item_label, item_conf in self._buffer:
            scores[item_label] = scores.get(item_label, 0.0) + max(item_conf, 0.01)
            counts[item_label] = counts.get(item_label, 0) + 1

        best_label = max(scores, key=scores.get)
        avg_conf = scores[best_label] / counts[best_label]
        return best_label, float(avg_conf)

    def reset(self) -> None:
        self._buffer.clear()


class ExponentialSmoother:
    def __init__(self, alpha: float = 0.4, initial: float = 0.0) -> None:
        self.alpha = max(0.01, min(0.99, alpha))
        self._value = float(initial)
        self._initialized = False

    def update(self, value: float) -> float:
        if not self._initialized:
            self._value = float(value)
            self._initialized = True
            return self._value
        self._value = self.alpha * float(value) + (1.0 - self.alpha) * self._value
        return self._value

    def reset(self, value: float = 0.0) -> None:
        self._value = float(value)
        self._initialized = False


class VectorSmoother:
    def __init__(self, dims: int = 3, alpha: float = 0.35) -> None:
        self.alpha = max(0.01, min(0.99, alpha))
        self._value = [0.0] * max(1, dims)
        self._initialized = False

    def update(self, values) -> list[float]:
        values = [float(v) for v in values]
        if not self._initialized:
            self._value = values
            self._initialized = True
            return list(self._value)
        self._value = [self.alpha * v + (1.0 - self.alpha) * prev for v, prev in zip(values, self._value)]
        return list(self._value)

    def reset(self) -> None:
        self._initialized = False

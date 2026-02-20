from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import joblib
import numpy as np

from utils.smoothing import TemporalSmoother


@dataclass
class PredictionResult:
    label: str
    confidence: float
    raw_label: str
    raw_confidence: float


class GesturePredictor:
    def __init__(
        self,
        model_path: Path,
        threshold: float = 0.8,
        smoothing_window: int = 5,
        auto_reload_sec: float = 1.0,
        logger: Optional[logging.Logger] = None,
    ) -> None:
        self.model_path = Path(model_path)
        self.threshold = threshold
        self.auto_reload_sec = auto_reload_sec
        self.logger = logger or logging.getLogger("gesture_ai")

        self.smoother = TemporalSmoother(window_size=smoothing_window)

        self._model = None
        self._labels: list[str] = []
        self._feature_count: Optional[int] = None
        self._last_mtime: Optional[float] = None
        self._last_reload_check = 0.0

        self.reload_model(force=True)

    def reload_model(self, force: bool = False) -> None:
        now = time.perf_counter()
        if not force and now - self._last_reload_check < self.auto_reload_sec:
            return
        self._last_reload_check = now

        if not self.model_path.exists():
            self._model = None
            return

        mtime = self.model_path.stat().st_mtime
        if not force and self._last_mtime is not None and mtime <= self._last_mtime:
            return

        payload = joblib.load(self.model_path)
        if isinstance(payload, dict) and "model" in payload:
            self._model = payload.get("model")
            self._labels = [str(v) for v in payload.get("labels", [])]
            feature_count = payload.get("feature_count")
            self._feature_count = int(feature_count) if feature_count is not None else None
        else:
            self._model = payload
            self._labels = [str(v) for v in getattr(self._model, "classes_", [])]
            self._feature_count = None

        self._last_mtime = mtime
        self.smoother.reset()
        self.logger.info("Modelo carregado/recarregado: %s", self.model_path)

    def predict(self, features) -> Optional[PredictionResult]:
        self.reload_model(force=False)
        if self._model is None:
            return None

        vector = np.asarray(features, dtype=np.float32).flatten()
        if self._feature_count is not None and vector.size != self._feature_count:
            self.logger.warning(
                "Feature vector incompativel com modelo. esperado=%s recebido=%s",
                self._feature_count,
                vector.size,
            )
            return None

        if not hasattr(self._model, "predict_proba"):
            return None

        probabilities = self._model.predict_proba(vector.reshape(1, -1))[0]
        classes = [str(v) for v in getattr(self._model, "classes_", self._labels)]
        if not classes:
            return None

        best_idx = int(np.argmax(probabilities))
        raw_label = classes[best_idx]
        raw_conf = float(probabilities[best_idx])

        filtered_label = raw_label if raw_conf >= self.threshold else "unknown"
        smoothed_label, smoothed_conf = self.smoother.update(
            filtered_label,
            raw_conf if filtered_label != "unknown" else 0.0,
        )

        return PredictionResult(
            label=smoothed_label,
            confidence=float(smoothed_conf),
            raw_label=raw_label,
            raw_confidence=raw_conf,
        )

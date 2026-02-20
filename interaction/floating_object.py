from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Tuple

import numpy as np

from utils.math_utils import clamp


@dataclass
class FloatingObject:
    position: np.ndarray = field(default_factory=lambda: np.array([0.0, 0.0, -3.0], dtype=np.float32))
    rotation_deg: np.ndarray = field(default_factory=lambda: np.array([0.0, 0.0, 0.0], dtype=np.float32))
    scale: float = 1.0
    object_type: str = "cube"
    color: Tuple[float, float, float] = (0.2, 0.85, 1.0)

    _colors: List[Tuple[float, float, float]] = field(
        default_factory=lambda: [
            (0.2, 0.85, 1.0),
            (1.0, 0.55, 0.25),
            (0.7, 0.9, 0.3),
            (0.8, 0.4, 0.9),
        ]
    )

    _types: List[str] = field(default_factory=lambda: ["cube", "pyramid", "sphere"])

    def apply_translation(self, delta: np.ndarray) -> None:
        self.position = self.position + delta
        self.position[0] = clamp(self.position[0], -2.5, 2.5)
        self.position[1] = clamp(self.position[1], -2.0, 2.0)
        self.position[2] = clamp(self.position[2], -8.0, -1.2)

    def apply_rotation(self, delta_deg: np.ndarray) -> None:
        self.rotation_deg = (self.rotation_deg + delta_deg) % 360.0

    def apply_scale(self, delta: float) -> None:
        self.scale = float(clamp(self.scale + delta, 0.25, 3.0))

    def reset(self) -> None:
        self.position = np.array([0.0, 0.0, -3.0], dtype=np.float32)
        self.rotation_deg = np.array([0.0, 0.0, 0.0], dtype=np.float32)
        self.scale = 1.0

    def toggle_type(self) -> None:
        current = self._types.index(self.object_type) if self.object_type in self._types else 0
        self.object_type = self._types[(current + 1) % len(self._types)]

    def toggle_color(self) -> None:
        current = self._colors.index(self.color) if self.color in self._colors else 0
        self.color = self._colors[(current + 1) % len(self._colors)]

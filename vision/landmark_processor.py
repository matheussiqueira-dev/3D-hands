from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple

import numpy as np

from utils.math_utils import angle_between, euclidean_distance


@dataclass
class HandAnalysis:
    features: np.ndarray
    points_norm: np.ndarray
    points_px: np.ndarray
    centroid_px: Tuple[int, int]
    pinch_distance: float
    openness: float
    builtin_gesture: str


class LandmarkProcessor:
    DISTANCE_PAIRS: List[Tuple[int, int]] = [
        (0, 4),
        (0, 8),
        (0, 12),
        (0, 16),
        (0, 20),
        (4, 8),
        (8, 12),
        (12, 16),
        (16, 20),
        (5, 9),
        (9, 13),
        (13, 17),
        (5, 17),
        (2, 4),
        (6, 8),
    ]

    ANGLE_TRIPLETS: List[Tuple[int, int, int]] = [
        (0, 1, 2),
        (1, 2, 3),
        (2, 3, 4),
        (0, 5, 6),
        (5, 6, 7),
        (6, 7, 8),
        (0, 9, 10),
        (9, 10, 11),
        (10, 11, 12),
        (0, 13, 14),
        (13, 14, 15),
        (14, 15, 16),
        (0, 17, 18),
        (17, 18, 19),
        (18, 19, 20),
    ]

    TIP_IDS = [4, 8, 12, 16, 20]
    MID_IDS = [3, 6, 10, 14, 18]

    def process(self, hand_landmarks, frame_shape, handedness: str = "Unknown") -> HandAnalysis:
        points = np.array(
            [[lm.x, lm.y, lm.z] for lm in hand_landmarks.landmark],
            dtype=np.float32,
        )
        height, width = frame_shape[:2]
        points_px = np.column_stack(
            (
                (points[:, 0] * width).astype(np.int32),
                (points[:, 1] * height).astype(np.int32),
            )
        )

        points_norm = self._normalize(points)
        features = self._build_feature_vector(points_norm)
        pinch_distance = euclidean_distance(points_norm[4], points_norm[8])
        openness = float(np.mean([euclidean_distance(points_norm[0], points_norm[idx]) for idx in self.TIP_IDS]))
        builtin_gesture = self._infer_builtin_gesture(points_norm, handedness)
        centroid_xy = points_px[:, :2].mean(axis=0).astype(np.int32)

        return HandAnalysis(
            features=features,
            points_norm=points_norm,
            points_px=points_px,
            centroid_px=(int(centroid_xy[0]), int(centroid_xy[1])),
            pinch_distance=float(pinch_distance),
            openness=openness,
            builtin_gesture=builtin_gesture,
        )

    @staticmethod
    def _normalize(points: np.ndarray) -> np.ndarray:
        translated = points - points[0]
        scale = np.max(np.linalg.norm(translated[:, :2], axis=1))
        scale = scale if scale > 1e-6 else 1.0
        return translated / scale

    def _build_feature_vector(self, points_norm: np.ndarray) -> np.ndarray:
        coords = points_norm.flatten()

        distances = np.array(
            [euclidean_distance(points_norm[a], points_norm[b]) for a, b in self.DISTANCE_PAIRS],
            dtype=np.float32,
        )

        angles = np.array(
            [angle_between(points_norm[a], points_norm[b], points_norm[c]) for a, b, c in self.ANGLE_TRIPLETS],
            dtype=np.float32,
        )

        thumb_index_dist = np.array([euclidean_distance(points_norm[4], points_norm[8])], dtype=np.float32)
        openness_vector = np.array(
            [euclidean_distance(points_norm[0], points_norm[idx]) for idx in self.TIP_IDS],
            dtype=np.float32,
        )

        palm_width = euclidean_distance(points_norm[5], points_norm[17])
        palm_height = euclidean_distance(points_norm[0], points_norm[9])
        palm_ratio = palm_width / (palm_height + 1e-6)
        palm_props = np.array([palm_width, palm_height, palm_ratio], dtype=np.float32)

        features = np.concatenate(
            [
                coords.astype(np.float32),
                distances,
                angles,
                thumb_index_dist,
                openness_vector,
                palm_props,
            ]
        )
        return features.astype(np.float32)

    def _infer_builtin_gesture(self, points_norm: np.ndarray, handedness: str) -> str:
        wrist = points_norm[0]
        extended = []
        for tip, mid in zip(self.TIP_IDS, self.MID_IDS):
            tip_dist = euclidean_distance(points_norm[tip], wrist)
            mid_dist = euclidean_distance(points_norm[mid], wrist)
            extended.append(tip_dist > (mid_dist + 0.02))

        pinch_distance = euclidean_distance(points_norm[4], points_norm[8])
        spread_metric = float(
            np.mean(
                [
                    euclidean_distance(points_norm[8], points_norm[12]),
                    euclidean_distance(points_norm[12], points_norm[16]),
                    euclidean_distance(points_norm[16], points_norm[20]),
                ]
            )
        )

        thumb_down = (
            points_norm[4][1] > points_norm[3][1] > points_norm[2][1]
            and sum(extended[1:]) <= 1
        )

        extended_count = sum(extended)
        if pinch_distance < 0.20:
            return "pinch"
        if thumb_down:
            return "thumb_down"
        if extended_count >= 4 and spread_metric > 0.33:
            return "spread"
        if extended_count >= 4:
            return "open_palm"
        if extended_count <= 1:
            return "fist"
        return "unknown"

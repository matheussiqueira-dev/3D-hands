from __future__ import annotations

from typing import Optional, Tuple

import cv2
import numpy as np

from ui.overlay_3d import draw_3d_status, draw_gesture_badge, draw_hand_bbox


HAND_CONNECTIONS = [
    (0, 1),
    (1, 2),
    (2, 3),
    (3, 4),
    (0, 5),
    (5, 6),
    (6, 7),
    (7, 8),
    (5, 9),
    (9, 10),
    (10, 11),
    (11, 12),
    (9, 13),
    (13, 14),
    (14, 15),
    (15, 16),
    (13, 17),
    (17, 18),
    (18, 19),
    (19, 20),
    (0, 17),
]


class DebugRenderer:
    def __init__(self, window_name: str) -> None:
        self.window_name = window_name
        cv2.namedWindow(self.window_name, cv2.WINDOW_NORMAL)

    def render(
        self,
        frame,
        fps: float,
        gesture_label: str,
        scale: float,
        rotation: Tuple[float, float, float],
        paused: bool,
        calibration_active: bool,
        status: str,
        hand_bbox: Optional[Tuple[int, int, int, int]] = None,
        hand_points: Optional[np.ndarray] = None,
    ) -> None:
        canvas = (frame * 0.55).astype(np.uint8)
        self._draw_hand(canvas, hand_points)
        draw_hand_bbox(canvas, hand_bbox)
        draw_3d_status(
            canvas,
            fps=fps,
            gesture_label=gesture_label,
            scale=scale,
            rotation=rotation,
            paused=paused,
            calibration_active=calibration_active,
            status=status,
        )
        if gesture_label not in {"idle", "unknown"}:
            draw_gesture_badge(canvas, gesture_label)

        cv2.imshow(self.window_name, canvas)

    @staticmethod
    def _draw_hand(frame, hand_points: Optional[np.ndarray]) -> None:
        if hand_points is None or len(hand_points) < 21:
            return

        points = hand_points.astype(np.int32)
        for start, end in HAND_CONNECTIONS:
            pt1 = (int(points[start][0]), int(points[start][1]))
            pt2 = (int(points[end][0]), int(points[end][1]))
            cv2.line(frame, pt1, pt2, (100, 190, 255), 2, cv2.LINE_AA)

        for idx, point in enumerate(points):
            color = (0, 220, 255) if idx in (4, 8, 12, 16, 20) else (200, 220, 255)
            cv2.circle(frame, (int(point[0]), int(point[1])), 3, color, -1, cv2.LINE_AA)

    def close(self) -> None:
        cv2.destroyAllWindows()

from __future__ import annotations

from typing import Iterable, Optional, Tuple

import cv2
import numpy as np

from interaction.object_manager import SceneObject
from ui.overlay import draw_hand_bbox, draw_status_block, draw_training_badge


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


class Renderer:
    def __init__(self, window_name: str) -> None:
        self.window_name = window_name
        cv2.namedWindow(self.window_name, cv2.WINDOW_NORMAL)

    def render(
        self,
        frame,
        objects: Iterable[SceneObject],
        fps: float,
        gesture_label: str,
        confidence: float,
        state: str,
        status: str,
        training_mode: bool,
        training_label: str,
        training_count: int,
        training_target: int,
        hand_bbox: Optional[Tuple[int, int, int, int]] = None,
        hand_points: Optional[np.ndarray] = None,
    ) -> None:
        canvas = (frame * 0.55).astype(np.uint8)

        self._draw_objects(canvas, objects)
        self._draw_hand(canvas, hand_points)
        draw_hand_bbox(canvas, hand_bbox)
        draw_status_block(
            canvas,
            fps=fps,
            gesture_label=gesture_label,
            confidence=confidence,
            state=state,
            status=status,
        )
        if training_mode:
            draw_training_badge(
                canvas,
                label=training_label,
                count=training_count,
                target=training_target,
            )

        cv2.imshow(self.window_name, canvas)

    @staticmethod
    def _draw_objects(frame, objects: Iterable[SceneObject]) -> None:
        for obj in objects:
            x1 = int(obj.x - obj.width / 2)
            y1 = int(obj.y - obj.height / 2)
            x2 = int(obj.x + obj.width / 2)
            y2 = int(obj.y + obj.height / 2)

            color = (0, 230, 255) if obj.is_selected else (120, 160, 210)
            thickness = 3 if obj.is_selected else 2
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness, cv2.LINE_AA)
            if obj.is_selected:
                overlay = frame.copy()
                cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 180, 255), -1, cv2.LINE_AA)
                cv2.addWeighted(overlay, 0.08, frame, 0.92, 0, frame)

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

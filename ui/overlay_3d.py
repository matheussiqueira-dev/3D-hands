from __future__ import annotations

from typing import Optional, Tuple

import cv2

from ui.overlay import draw_panel


def draw_3d_status(
    frame,
    fps: float,
    gesture_label: str,
    scale: float,
    rotation: Tuple[float, float, float],
    paused: bool,
    calibration_active: bool,
    status: str,
) -> None:
    draw_panel(frame, (18, 18), (420, 176))
    lines = [
        f"FPS: {fps:5.1f}",
        f"Gesto: {gesture_label}",
        f"Escala: {scale:4.2f}",
        f"Rot: X={rotation[0]:5.1f} Y={rotation[1]:5.1f} Z={rotation[2]:5.1f}",
        f"Status: {status}",
        f"Pausa: {'ON' if paused else 'OFF'}",
    ]
    if calibration_active:
        lines.append("Calibrando profundidade...")

    y = 45
    for line in lines:
        cv2.putText(frame, line, (34, y), cv2.FONT_HERSHEY_SIMPLEX, 0.56, (225, 230, 240), 1, cv2.LINE_AA)
        y += 24


def draw_gesture_badge(frame, label: str, position: Tuple[int, int] = (18, 205)) -> None:
    draw_panel(frame, position, (260, 50), color=(30, 30, 18), alpha=0.78)
    cv2.putText(frame, f"ATIVO: {label}", (position[0] + 16, position[1] + 32), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 220, 120), 1, cv2.LINE_AA)


def draw_hand_bbox(frame, bbox: Optional[Tuple[int, int, int, int]]) -> None:
    if not bbox:
        return
    x1, y1, x2, y2 = bbox
    cv2.rectangle(frame, (x1, y1), (x2, y2), (90, 200, 255), 2, cv2.LINE_AA)

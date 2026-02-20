from __future__ import annotations

from typing import Optional, Tuple

import cv2


def draw_panel(
    frame,
    top_left: Tuple[int, int],
    size: Tuple[int, int],
    color: Tuple[int, int, int] = (18, 18, 22),
    alpha: float = 0.72,
) -> None:
    x, y = top_left
    w, h = size
    overlay = frame.copy()
    cv2.rectangle(overlay, (x, y), (x + w, y + h), color, -1, cv2.LINE_AA)
    cv2.addWeighted(overlay, alpha, frame, 1.0 - alpha, 0, frame)
    cv2.rectangle(frame, (x, y), (x + w, y + h), (80, 80, 90), 1, cv2.LINE_AA)


def draw_status_block(
    frame,
    fps: float,
    gesture_label: str,
    confidence: float,
    state: str,
    status: str,
) -> None:
    draw_panel(frame, (18, 18), (370, 148))
    lines = [
        f"FPS: {fps:5.1f}",
        f"Gesto: {gesture_label}",
        f"Confianca: {confidence * 100:5.1f}%",
        f"Estado: {state}",
        f"Status: {status}",
    ]
    y = 45
    for line in lines:
        cv2.putText(frame, line, (34, y), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (225, 230, 240), 1, cv2.LINE_AA)
        y += 25


def draw_training_badge(frame, label: str, count: int, target: int) -> None:
    draw_panel(frame, (18, 178), (370, 72), color=(35, 35, 22), alpha=0.78)
    progress = min(1.0, count / max(1, target))
    cv2.putText(
        frame,
        f"TREINO: {label} [{count}/{target}]",
        (34, 206),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (255, 235, 120),
        1,
        cv2.LINE_AA,
    )
    x, y, w, h = 34, 218, 320, 12
    cv2.rectangle(frame, (x, y), (x + w, y + h), (70, 70, 70), 1, cv2.LINE_AA)
    cv2.rectangle(frame, (x + 1, y + 1), (x + int((w - 2) * progress), y + h - 1), (70, 200, 255), -1, cv2.LINE_AA)


def draw_hand_bbox(frame, bbox: Optional[Tuple[int, int, int, int]]) -> None:
    if not bbox:
        return
    x1, y1, x2, y2 = bbox
    cv2.rectangle(frame, (x1, y1), (x2, y2), (90, 200, 255), 2, cv2.LINE_AA)

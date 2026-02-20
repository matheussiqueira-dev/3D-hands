from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Optional

from core.constants import (
    GESTURE_TO_STATE,
    STATE_CREATING,
    STATE_DELETING,
    STATE_IDLE,
    STATE_MOVING,
    STATE_RESIZING,
)
from interaction.object_manager import ObjectManager
from vision.landmark_processor import HandAnalysis


@dataclass
class InteractionSnapshot:
    state: str
    status: str


class InteractionEngine:
    def __init__(self, object_manager: ObjectManager) -> None:
        self.object_manager = object_manager
        self.state = STATE_IDLE
        self.status_message = "Aguardando gesto"
        self.gesture_to_state = dict(GESTURE_TO_STATE)

        self._last_create_time = 0.0
        self._last_delete_time = 0.0
        self._last_openness: Optional[float] = None

    def update(self, gesture_label: str, analysis: Optional[HandAnalysis], frame_shape=None) -> InteractionSnapshot:
        target_state = self.gesture_to_state.get(gesture_label, STATE_IDLE)
        if target_state != self.state:
            self.state = target_state
            if self.state != STATE_RESIZING:
                self._last_openness = None

        if analysis is None:
            self.status_message = "Sem mao detectada"
            return InteractionSnapshot(state=self.state, status=self.status_message)

        cursor = analysis.centroid_px
        now = time.perf_counter()

        if self.state == STATE_CREATING:
            if now - self._last_create_time > 0.9:
                created = self.object_manager.create_object(cursor)
                self._last_create_time = now
                self.status_message = f"Objeto #{created.object_id} criado"
            else:
                self.status_message = "Cooldown de criacao"

        elif self.state == STATE_MOVING:
            selected = self.object_manager.get_selected() or self.object_manager.select_nearest(cursor)
            if selected:
                moved = self.object_manager.move_selected(cursor, frame_shape=frame_shape)
                self.status_message = f"Movendo objeto #{moved.object_id}"
            else:
                self.status_message = "Nenhum objeto selecionado"

        elif self.state == STATE_RESIZING:
            selected = self.object_manager.get_selected() or self.object_manager.select_nearest(cursor)
            if selected:
                if self._last_openness is None:
                    self._last_openness = analysis.openness
                delta = analysis.openness - self._last_openness
                scale = 1.0 + max(min(delta * 1.8, 0.25), -0.25)
                resized = self.object_manager.resize_selected(scale)
                self._last_openness = analysis.openness
                self.status_message = f"Redimensionando objeto #{resized.object_id}"
            else:
                self.status_message = "Nenhum objeto para redimensionar"

        elif self.state == STATE_DELETING:
            if now - self._last_delete_time > 0.8:
                deleted = self.object_manager.delete_nearest(cursor)
                self._last_delete_time = now
                self.status_message = "Objeto removido" if deleted else "Sem objeto para remover"
            else:
                self.status_message = "Cooldown de remocao"

        else:
            self.status_message = "Modo ocioso"

        return InteractionSnapshot(state=self.state, status=self.status_message)

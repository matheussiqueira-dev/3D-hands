from __future__ import annotations

from dataclasses import dataclass
from itertools import count
from typing import List, Optional, Tuple

from utils.math_utils import clamp, euclidean_distance


@dataclass
class SceneObject:
    object_id: int
    x: int
    y: int
    width: int = 120
    height: int = 120
    color: Tuple[int, int, int] = (0, 208, 255)
    is_selected: bool = False


class ObjectManager:
    def __init__(self) -> None:
        self._id_generator = count(start=1)
        self._objects: List[SceneObject] = []
        self.selected_id: Optional[int] = None

    def create_object(self, center: Tuple[int, int]) -> SceneObject:
        obj = SceneObject(object_id=next(self._id_generator), x=center[0], y=center[1])
        self._objects.append(obj)
        self.selected_id = obj.object_id
        self._sync_selected_flag()
        return obj

    def objects(self) -> List[SceneObject]:
        return list(self._objects)

    def get_selected(self) -> Optional[SceneObject]:
        for obj in self._objects:
            if obj.object_id == self.selected_id:
                return obj
        return None

    def select_nearest(self, point: Tuple[int, int], max_distance: float = 220.0) -> Optional[SceneObject]:
        if not self._objects:
            self.selected_id = None
            return None

        nearest_obj = None
        nearest_dist = float("inf")
        for obj in self._objects:
            distance = euclidean_distance((obj.x, obj.y), point)
            if distance < nearest_dist:
                nearest_dist = distance
                nearest_obj = obj

        if nearest_obj and nearest_dist <= max_distance:
            self.selected_id = nearest_obj.object_id
        else:
            self.selected_id = None

        self._sync_selected_flag()
        return self.get_selected()

    def move_selected(self, point: Tuple[int, int], frame_shape=None) -> Optional[SceneObject]:
        selected = self.get_selected()
        if selected is None:
            return None

        if frame_shape is not None:
            frame_h, frame_w = frame_shape[:2]
            half_w = selected.width // 2
            half_h = selected.height // 2
            selected.x = int(clamp(point[0], half_w, frame_w - half_w))
            selected.y = int(clamp(point[1], half_h, frame_h - half_h))
        else:
            selected.x = int(point[0])
            selected.y = int(point[1])
        return selected

    def resize_selected(self, scale: float) -> Optional[SceneObject]:
        selected = self.get_selected()
        if selected is None:
            return None

        selected.width = int(clamp(selected.width * scale, 40, 420))
        selected.height = int(clamp(selected.height * scale, 40, 420))
        return selected

    def delete_selected(self) -> bool:
        selected = self.get_selected()
        if selected is None:
            return False
        self._objects = [obj for obj in self._objects if obj.object_id != selected.object_id]
        self.selected_id = None
        self._sync_selected_flag()
        return True

    def delete_nearest(self, point: Tuple[int, int], max_distance: float = 220.0) -> bool:
        selected = self.select_nearest(point, max_distance=max_distance)
        if not selected:
            return False
        return self.delete_selected()

    def _sync_selected_flag(self) -> None:
        for obj in self._objects:
            obj.is_selected = obj.object_id == self.selected_id

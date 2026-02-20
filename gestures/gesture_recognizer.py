from __future__ import annotations

import math
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np

from core.config import AppConfig
from utils.math_utils import euclidean_distance
from utils.smoothing import ExponentialSmoother, VectorSmoother
from vision.landmark_processor import HandAnalysis


@dataclass
class FingerState:
    thumb: bool
    index: bool
    middle: bool
    ring: bool
    pinky: bool

    @property
    def extended_count(self) -> int:
        return int(self.thumb) + int(self.index) + int(self.middle) + int(self.ring) + int(self.pinky)


@dataclass
class HandState:
    handedness: str
    analysis: HandAnalysis
    fingers: FingerState
    centroid_px: Tuple[int, int]
    depth: float
    palm_roll_deg: float


@dataclass
class GestureOutput:
    gesture_name: str
    translation: np.ndarray
    rotation: np.ndarray
    scale_delta: float
    reset: bool
    toggle_object: bool
    toggle_color: bool
    toggle_pause: bool
    spin_active: bool
    calibration_active: bool


class GestureLatch:
    def __init__(self, hold_sec: float, cooldown_sec: float = 0.0) -> None:
        self.hold_sec = max(0.05, hold_sec)
        self.cooldown_sec = max(0.0, cooldown_sec)
        self._active_since: Optional[float] = None
        self._last_trigger = 0.0

    def update(self, active: bool, now: float) -> Tuple[bool, bool]:
        if not active:
            self._active_since = None
            return False, False

        if self._active_since is None:
            self._active_since = now

        held_for = now - self._active_since
        held = held_for >= self.hold_sec

        if held and (now - self._last_trigger) >= self.cooldown_sec:
            self._last_trigger = now
            return True, True

        return False, held


class GestureRecognizer:
    TIP_IDS = [4, 8, 12, 16, 20]
    MID_IDS = [3, 6, 10, 14, 18]

    def __init__(self, config: AppConfig, simple_mode: bool = False) -> None:
        self.config = config
        self.simple_mode = simple_mode
        self._last_centroid: Dict[str, Tuple[int, int]] = {}
        self._last_pinch: Dict[str, float] = {}
        self._last_roll: Dict[str, float] = {}

        self._depth_reference: Optional[float] = None
        self._two_hand_reference: Optional[float] = None
        self._calibration_start: Optional[float] = None

        self._translation_smoother = VectorSmoother(dims=3, alpha=0.35)
        self._rotation_smoother = VectorSmoother(dims=3, alpha=0.3)
        self._scale_smoother = ExponentialSmoother(alpha=0.4)

        self._reset_latch = GestureLatch(self.config.reset_hold_sec, cooldown_sec=1.0)
        self._swap_latch = GestureLatch(self.config.swap_hold_sec, cooldown_sec=1.0)
        self._color_latch = GestureLatch(self.config.color_hold_sec, cooldown_sec=0.6)
        self._pause_latch = GestureLatch(0.2, cooldown_sec=self.config.pause_cooldown_sec)
        self._spin_latch = GestureLatch(self.config.spin_hold_sec)

    def update(self, hands: List[HandState], now: Optional[float] = None) -> GestureOutput:
        timestamp = now or time.perf_counter()
        translation = np.zeros(3, dtype=np.float32)
        rotation = np.zeros(3, dtype=np.float32)
        scale_delta = 0.0

        reset = False
        toggle_object = False
        toggle_color = False
        toggle_pause = False
        spin_active = False
        gesture_name = "idle"

        if not hands:
            self._calibration_start = None
            return GestureOutput(
                gesture_name=gesture_name,
                translation=translation,
                rotation=rotation,
                scale_delta=scale_delta,
                reset=reset,
                toggle_object=toggle_object,
                toggle_color=toggle_color,
                toggle_pause=toggle_pause,
                spin_active=spin_active,
                calibration_active=False,
            )

        primary = self._select_primary(hands)
        secondary = self._select_secondary(hands, primary)

        calibration_active = self._update_calibration(primary, secondary, timestamp)

        if primary:
            gesture_name = self._label_primary(primary)
            translation += self._translate_from_palm(primary)
            translation[2] += self._translate_depth(primary)

            pinch_delta = self._scale_from_pinch(primary)
            if abs(pinch_delta) > 1e-4:
                scale_delta += pinch_delta
                gesture_name = "pinch" if gesture_name == "idle" else gesture_name

            rot_delta = self._rotate_from_two_fingers(primary)
            if np.linalg.norm(rot_delta) > 1e-4:
                rotation += rot_delta
                gesture_name = "rotate" if gesture_name == "idle" else gesture_name

            reset, _ = self._reset_latch.update(self._is_fist(primary), timestamp)
            if reset:
                gesture_name = "reset"

            swap, _ = self._swap_latch.update(self._is_v_sign(primary), timestamp)
            if swap:
                toggle_object = True
                gesture_name = "swap_object"

            color, _ = self._color_latch.update(self._is_three_fingers(primary), timestamp)
            if color:
                toggle_color = True
                gesture_name = "swap_color"

            pause_trigger, _ = self._pause_latch.update(self._is_thumb_down(primary), timestamp)
            if pause_trigger:
                toggle_pause = True
                gesture_name = "pause"

            _, spin_held = self._spin_latch.update(self._is_thumb_up(primary), timestamp)
            spin_active = spin_held
            if spin_active:
                gesture_name = "spin"

        if not self.simple_mode and primary and secondary:
            two_hand_scale = self._scale_from_two_hands(primary, secondary)
            if abs(two_hand_scale) > 1e-4:
                scale_delta += two_hand_scale
                gesture_name = "two_hand_scale"

        translation = np.array(self._translation_smoother.update(translation), dtype=np.float32)
        rotation = np.array(self._rotation_smoother.update(rotation), dtype=np.float32)
        scale_delta = float(self._scale_smoother.update(scale_delta))

        return GestureOutput(
            gesture_name=gesture_name,
            translation=translation,
            rotation=rotation,
            scale_delta=scale_delta,
            reset=reset,
            toggle_object=toggle_object,
            toggle_color=toggle_color,
            toggle_pause=toggle_pause,
            spin_active=spin_active,
            calibration_active=calibration_active,
        )

    def _select_primary(self, hands: List[HandState]) -> HandState:
        preferred = self.config.dominant_hand.lower()
        for hand in hands:
            if hand.handedness.lower() == preferred:
                return hand
        return hands[0]

    @staticmethod
    def _select_secondary(hands: List[HandState], primary: HandState) -> Optional[HandState]:
        for hand in hands:
            if hand is not primary:
                return hand
        return None

    def _translate_from_palm(self, hand: HandState) -> np.ndarray:
        if not self._is_open_palm(hand):
            return np.zeros(3, dtype=np.float32)

        last = self._last_centroid.get(hand.handedness)
        self._last_centroid[hand.handedness] = hand.centroid_px
        if last is None:
            return np.zeros(3, dtype=np.float32)

        dx = hand.centroid_px[0] - last[0]
        dy = hand.centroid_px[1] - last[1]
        if abs(dx) < self.config.deadzone_px and abs(dy) < self.config.deadzone_px:
            return np.zeros(3, dtype=np.float32)

        return np.array(
            [dx * self.config.translation_sensitivity, -dy * self.config.translation_sensitivity, 0.0],
            dtype=np.float32,
        )

    def _translate_depth(self, hand: HandState) -> float:
        if self._depth_reference is None:
            return 0.0

        if not self._is_open_palm(hand):
            return 0.0

        delta = self._depth_reference - hand.depth
        if abs(delta) < 0.008:
            return 0.0
        return float(delta * self.config.depth_sensitivity)

    def _scale_from_pinch(self, hand: HandState) -> float:
        if not self._is_pinch(hand):
            self._last_pinch.pop(hand.handedness, None)
            return 0.0

        pinch = hand.analysis.pinch_distance
        last = self._last_pinch.get(hand.handedness)
        self._last_pinch[hand.handedness] = pinch
        if last is None:
            return 0.0

        delta = pinch - last
        if abs(delta) < 0.004:
            return 0.0
        return float(delta * self.config.pinch_scale_sensitivity)

    def _rotate_from_two_fingers(self, hand: HandState) -> np.ndarray:
        if not self._is_two_fingers(hand):
            self._last_centroid.pop(hand.handedness, None)
            self._last_roll.pop(hand.handedness, None)
            return np.zeros(3, dtype=np.float32)

        last = self._last_centroid.get(hand.handedness)
        self._last_centroid[hand.handedness] = hand.centroid_px
        if last is None:
            return np.zeros(3, dtype=np.float32)

        dx = hand.centroid_px[0] - last[0]
        dy = hand.centroid_px[1] - last[1]
        if abs(dx) < self.config.deadzone_px and abs(dy) < self.config.deadzone_px:
            dx = 0
            dy = 0

        roll_last = self._last_roll.get(hand.handedness)
        self._last_roll[hand.handedness] = hand.palm_roll_deg
        roll_delta = 0.0 if roll_last is None else (hand.palm_roll_deg - roll_last)

        return np.array(
            [
                -dy * self.config.rotation_sensitivity,
                dx * self.config.rotation_sensitivity,
                roll_delta * 0.6,
            ],
            dtype=np.float32,
        )

    def _scale_from_two_hands(self, primary: HandState, secondary: HandState) -> float:
        if not self._is_open_palm(primary) or not self._is_open_palm(secondary):
            return 0.0

        distance = euclidean_distance(primary.centroid_px, secondary.centroid_px)
        if self._two_hand_reference is None:
            self._two_hand_reference = distance
            return 0.0

        delta = distance - self._two_hand_reference
        if abs(delta) < 6.0:
            return 0.0
        return float(delta * self.config.two_hand_scale_sensitivity)

    def _update_calibration(self, primary: HandState, secondary: Optional[HandState], now: float) -> bool:
        if self._depth_reference is not None:
            return False

        if not self._is_open_palm(primary):
            self._calibration_start = None
            return False

        if self._calibration_start is None:
            self._calibration_start = now

        elapsed = now - self._calibration_start
        if elapsed < self.config.calibration_sec:
            return True

        self._depth_reference = primary.depth
        if secondary:
            self._two_hand_reference = euclidean_distance(primary.centroid_px, secondary.centroid_px)
        return False

    def _label_primary(self, hand: HandState) -> str:
        if self._is_pinch(hand):
            return "pinch"
        if self._is_two_fingers(hand):
            return "two_fingers"
        if self._is_open_palm(hand):
            return "open_palm"
        if self._is_fist(hand):
            return "fist"
        if self._is_v_sign(hand):
            return "v_sign"
        return "idle"

    def _is_open_palm(self, hand: HandState) -> bool:
        return hand.fingers.extended_count >= 4

    def _is_fist(self, hand: HandState) -> bool:
        return hand.fingers.extended_count <= 1 and not hand.fingers.thumb

    def _is_pinch(self, hand: HandState) -> bool:
        return hand.analysis.pinch_distance < 0.18

    def _is_two_fingers(self, hand: HandState) -> bool:
        return hand.fingers.index and hand.fingers.middle and not hand.fingers.ring and not hand.fingers.pinky

    def _is_v_sign(self, hand: HandState) -> bool:
        if not self._is_two_fingers(hand):
            return False
        distance = euclidean_distance(hand.analysis.points_norm[8], hand.analysis.points_norm[12])
        return distance > 0.28

    def _is_three_fingers(self, hand: HandState) -> bool:
        return hand.fingers.index and hand.fingers.middle and hand.fingers.ring and not hand.fingers.pinky

    def _is_thumb_only(self, hand: HandState) -> bool:
        return hand.fingers.thumb and not (hand.fingers.index or hand.fingers.middle or hand.fingers.ring or hand.fingers.pinky)

    def _is_thumb_up(self, hand: HandState) -> bool:
        if not self._is_thumb_only(hand):
            return False
        tip_y = hand.analysis.points_norm[4][1]
        base_y = hand.analysis.points_norm[2][1]
        return tip_y < base_y - 0.04

    def _is_thumb_down(self, hand: HandState) -> bool:
        if not self._is_thumb_only(hand):
            return False
        tip_y = hand.analysis.points_norm[4][1]
        base_y = hand.analysis.points_norm[2][1]
        return tip_y > base_y + 0.04

    @classmethod
    def build_hand_state(cls, analysis: HandAnalysis, handedness: str) -> HandState:
        fingers = cls._compute_finger_state(analysis.points_norm)
        centroid = analysis.centroid_px
        depth = float(np.mean(analysis.points_norm[:, 2]))
        palm_roll = cls._compute_palm_roll_deg(analysis.points_px)
        return HandState(
            handedness=handedness,
            analysis=analysis,
            fingers=fingers,
            centroid_px=centroid,
            depth=depth,
            palm_roll_deg=palm_roll,
        )

    @staticmethod
    def _compute_finger_state(points_norm: np.ndarray) -> FingerState:
        wrist = points_norm[0]
        extended = []
        for tip, mid in zip(GestureRecognizer.TIP_IDS, GestureRecognizer.MID_IDS):
            tip_dist = euclidean_distance(points_norm[tip], wrist)
            mid_dist = euclidean_distance(points_norm[mid], wrist)
            extended.append(tip_dist > (mid_dist + 0.02))

        return FingerState(
            thumb=extended[0],
            index=extended[1],
            middle=extended[2],
            ring=extended[3],
            pinky=extended[4],
        )

    @staticmethod
    def _compute_palm_roll_deg(points_px: np.ndarray) -> float:
        index_mcp = points_px[5]
        pinky_mcp = points_px[17]
        vector = pinky_mcp - index_mcp
        angle = math.degrees(math.atan2(vector[1], vector[0]))
        return float(angle)

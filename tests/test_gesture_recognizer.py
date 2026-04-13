"""
Unit tests for gestures/gesture_recognizer.py
Author: Matheus Siqueira <https://www.matheussiqueira.dev/>
"""
from __future__ import annotations
import pytest


class _Lm:
    def __init__(self, x=0.0, y=0.0, z=0.0):
        self.x, self.y, self.z = x, y, z


def _make(n=21):
    return [_Lm() for _ in range(n)]


def _pinch():
    lms = _make()
    lms[4].x, lms[4].y = 0.50, 0.50
    lms[8].x, lms[8].y = 0.52, 0.50
    return lms


def _open_palm():
    lms = _make()
    lms[0].y = 0.9
    for tip in (4, 8, 12, 16, 20): lms[tip].y = 0.1
    for mcp in (2, 5, 9, 13, 17):  lms[mcp].y = 0.7
    return lms


class TestGestureRecognizer:
    def setup_method(self):
        from gestures.gesture_recognizer import GestureRecognizer
        self.r = GestureRecognizer()

    def test_pinch_detected_when_tips_close(self):
        assert self.r.detect_pinch(_pinch()) is True

    def test_pinch_not_detected_when_tips_far(self):
        lms = _make()
        lms[4].x, lms[4].y = 0.1, 0.1
        lms[8].x, lms[8].y = 0.9, 0.9
        assert self.r.detect_pinch(lms) is False

    def test_open_palm_has_extended_fingers(self):
        assert self.r.count_extended_fingers(_open_palm()) >= 4

    def test_fist_has_no_extended_fingers(self):
        assert self.r.count_extended_fingers(_make()) == 0

    def test_handles_empty_landmarks_gracefully(self):
        try:
            self.r.detect_pinch([])
        except (IndexError, AttributeError):
            pytest.fail("Raised on empty landmarks")

    def test_two_hand_scale_positive_when_apart(self):
        lms1, lms2 = _make(), _make()
        lms1[0].x = 0.2; lms2[0].x = 0.8
        scale = self.r.compute_two_hand_scale(lms1, lms2)
        assert scale > 0

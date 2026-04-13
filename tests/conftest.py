"""Shared pytest fixtures. Author: Matheus Siqueira <https://www.matheussiqueira.dev/>"""
from __future__ import annotations
import pytest


class _Lm:
    def __init__(self, x=0.0, y=0.0, z=0.0):
        self.x, self.y, self.z = x, y, z


def _make(n=21):
    return [_Lm() for _ in range(n)]


@pytest.fixture
def zero_landmarks():
    """21 landmarks all at origin."""
    return _make(21)


@pytest.fixture
def pinch_landmarks():
    """Thumb tip (4) and index tip (8) very close — distance ~0.02."""
    lms = _make()
    lms[4].x, lms[4].y = 0.50, 0.50
    lms[8].x, lms[8].y = 0.52, 0.50
    return lms


@pytest.fixture
def open_palm_landmarks():
    """All fingertips above wrist — extended palm pose."""
    lms = _make()
    lms[0].x, lms[0].y = 0.5, 0.9  # wrist
    for tip in (4, 8, 12, 16, 20):
        lms[tip].x, lms[tip].y = 0.5, 0.1
    for mcp in (2, 5, 9, 13, 17):
        lms[mcp].x, lms[mcp].y = 0.5, 0.7
    return lms

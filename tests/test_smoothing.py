"""
Unit tests for utils/smoothing.py
Author: Matheus Siqueira <https://www.matheussiqueira.dev/>
"""
from __future__ import annotations
import pytest
from utils.smoothing import ExponentialSmoother, VectorSmoother, TemporalSmoother


class TestExponentialSmoother:
    def test_first_sample_returned_unchanged(self):
        s = ExponentialSmoother(alpha=0.5)
        assert s.update(10.0) == pytest.approx(10.0)

    def test_converges_to_constant_input(self):
        s = ExponentialSmoother(alpha=0.5)
        val = 0.0
        for _ in range(50):
            val = s.update(100.0)
        assert val == pytest.approx(100.0, abs=0.5)

    def test_high_alpha_more_responsive(self):
        fast = ExponentialSmoother(alpha=0.9)
        slow = ExponentialSmoother(alpha=0.1)
        for _ in range(5):
            f = fast.update(100.0)
            s = slow.update(100.0)
        assert f > s

    def test_reset_clears_state(self):
        s = ExponentialSmoother(alpha=0.5)
        for _ in range(10):
            s.update(100.0)
        s.reset()
        assert s.update(0.0) == pytest.approx(0.0)


class TestVectorSmoother:
    def test_first_vector_unchanged(self):
        s = VectorSmoother(alpha=0.5)
        assert s.update([1.0, 2.0, 3.0]) == pytest.approx([1.0, 2.0, 3.0])

    def test_converges_to_constant_vector(self):
        s = VectorSmoother(alpha=0.5)
        result = None
        for _ in range(60):
            result = s.update([10.0, 20.0, 30.0])
        assert result == pytest.approx([10.0, 20.0, 30.0], abs=0.5)

    def test_reset_clears_state(self):
        s = VectorSmoother(alpha=0.5)
        for _ in range(10):
            s.update([100.0, 100.0])
        s.reset()
        assert s.update([0.0, 0.0]) == pytest.approx([0.0, 0.0])


class TestTemporalSmoother:
    def test_majority_label_wins(self):
        s = TemporalSmoother(window=5)
        for label in ["a", "a", "a", "b", "b"]:
            s.update(label, 0.9)
        assert s.get_smoothed_label() == "a"

    def test_returns_none_when_empty(self):
        s = TemporalSmoother(window=5)
        assert s.get_smoothed_label() is None

    def test_window_slides_correctly(self):
        s = TemporalSmoother(window=3)
        for label in ["a", "a", "b", "b", "b"]:
            s.update(label, 0.9)
        assert s.get_smoothed_label() == "b"

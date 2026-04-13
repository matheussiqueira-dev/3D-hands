"""
Unit tests for utils/math_utils.py
Author: Matheus Siqueira <https://www.matheussiqueira.dev/>
"""
from __future__ import annotations

import math
import pytest

from utils.math_utils import (
    euclidean_distance,
    angle_between,
    normalize_vector,
    clamp,
    rotation_matrix_x,
    rotation_matrix_y,
    rotation_matrix_z,
)


class TestEuclideanDistance:
    def test_zero_distance(self):
        assert euclidean_distance([0, 0], [0, 0]) == pytest.approx(0.0)

    def test_unit_distance_2d(self):
        assert euclidean_distance([0, 0], [1, 0]) == pytest.approx(1.0)

    def test_pythagorean_triple(self):
        assert euclidean_distance([0, 0], [3, 4]) == pytest.approx(5.0)

    def test_3d_distance(self):
        assert euclidean_distance([0, 0, 0], [1, 1, 1]) == pytest.approx(math.sqrt(3))

    def test_negative_coords(self):
        assert euclidean_distance([-1, -1], [1, 1]) == pytest.approx(math.sqrt(8))


class TestAngleBetween:
    def test_right_angle(self):
        a, b, c = [0, 1], [0, 0], [1, 0]
        assert angle_between(a, b, c) == pytest.approx(math.pi / 2, abs=1e-6)

    def test_angle_symmetry(self):
        a, b, c = [1, 0], [0, 0], [0, 1]
        assert angle_between(a, b, c) == pytest.approx(angle_between(c, b, a), abs=1e-9)


class TestNormalizeVector:
    def test_unit_vector_unchanged(self):
        import numpy as np
        result = normalize_vector([1.0, 0.0, 0.0])
        np.testing.assert_allclose(result, [1.0, 0.0, 0.0], atol=1e-9)

    def test_normalized_length_is_one(self):
        import numpy as np
        result = normalize_vector([3.0, 4.0, 0.0])
        assert np.linalg.norm(result) == pytest.approx(1.0)

    def test_zero_vector_returns_zero(self):
        import numpy as np
        result = normalize_vector([0.0, 0.0, 0.0])
        np.testing.assert_array_equal(result, [0.0, 0.0, 0.0])


class TestClamp:
    def test_below_min(self):  assert clamp(-5, 0, 10) == 0
    def test_above_max(self):  assert clamp(15, 0, 10) == 10
    def test_within(self):     assert clamp(5,  0, 10) == 5
    def test_at_boundary(self): assert clamp(0, 0, 10) == 0 and clamp(10, 0, 10) == 10


@pytest.mark.parametrize("factory", [rotation_matrix_x, rotation_matrix_y, rotation_matrix_z])
class TestRotationMatrices:
    def test_zero_is_identity(self, factory):
        import numpy as np
        np.testing.assert_allclose(factory(0.0), np.eye(3), atol=1e-9)

    def test_full_rotation_is_identity(self, factory):
        import numpy as np
        np.testing.assert_allclose(factory(2 * math.pi), np.eye(3), atol=1e-6)

    def test_orthogonal(self, factory):
        import numpy as np
        R = factory(math.pi / 4)
        np.testing.assert_allclose(R @ R.T, np.eye(3), atol=1e-9)

    def test_determinant_one(self, factory):
        import numpy as np
        assert np.linalg.det(factory(math.pi / 3)) == pytest.approx(1.0, abs=1e-9)

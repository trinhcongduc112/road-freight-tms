"""Unit tests cho hgs.distance — haversine + ma trận khoảng cách."""
import math
import numpy as np
import pytest

from hgs.distance import haversine, build_distance_matrix, minutes_to_hhmm


class TestHaversine:
    def test_same_point_zero_distance(self):
        assert haversine(10.0, 106.0, 10.0, 106.0) == 0.0

    def test_hanoi_to_hcmc_approx_1100km(self):
        # Hà Nội ≈ (21.02, 105.83), HCMC ≈ (10.78, 106.70)
        d = haversine(21.0285, 105.8542, 10.7769, 106.7009)
        # Thực tế ~1150 km theo đường chim bay
        assert 1100 <= d <= 1200

    def test_symmetric(self):
        d1 = haversine(10.0, 106.0, 11.0, 107.0)
        d2 = haversine(11.0, 107.0, 10.0, 106.0)
        assert math.isclose(d1, d2, rel_tol=1e-9)

    def test_one_degree_lat_approx_111km(self):
        # 1° lat ≈ 111 km tại xích đạo
        d = haversine(0.0, 0.0, 1.0, 0.0)
        assert math.isclose(d, 111.19, abs_tol=0.5)


class TestDistanceMatrix:
    def test_diagonal_is_zero(self):
        points = [(10.0, 106.0), (11.0, 107.0), (10.5, 106.5)]
        m = build_distance_matrix(points)
        assert m.shape == (3, 3)
        for i in range(3):
            assert m[i, i] == 0.0

    def test_symmetric(self):
        points = [(10.0, 106.0), (11.0, 107.0), (10.5, 106.5)]
        m = build_distance_matrix(points)
        assert np.allclose(m, m.T)

    def test_consistent_with_haversine(self):
        points = [(10.0, 106.0), (11.0, 107.0)]
        m = build_distance_matrix(points)
        expected = haversine(10.0, 106.0, 11.0, 107.0)
        assert math.isclose(m[0, 1], expected, abs_tol=0.01)


class TestMinutesToHhmm:
    def test_zero(self):
        assert minutes_to_hhmm(0) == "00:00"

    def test_morning(self):
        assert minutes_to_hhmm(8 * 60 + 30) == "08:30"

    def test_wraps_24h(self):
        # 25h = 1h sáng hôm sau
        assert minutes_to_hhmm(25 * 60) == "01:00"

    def test_fractional_rounded(self):
        assert minutes_to_hhmm(60.4) == "01:00"
        assert minutes_to_hhmm(60.6) == "01:01"

"""Unit tests cho TrafficModel — empirical traffic factor."""
import pytest

from hgs.traffic import TrafficModel, HourBucket, ZoneBucket


class TestEmptyModel:
    def test_empty_returns_1_for_all_factors(self):
        m = TrafficModel()
        assert m.hour_factor(8 * 60) == 1.0
        assert m.dow_factor() == 1.0
        assert m.zone_factor(5.0) == 1.0
        assert m.total_factor(8 * 60, 5.0) == 1.0


class TestHourFactor:
    def test_match_within_bucket(self):
        m = TrafficModel(hour_buckets=[HourBucket(start=7, end=9, factor=1.5)])
        assert m.hour_factor(8 * 60) == 1.5         # 8h sáng
        assert m.hour_factor(7 * 60 + 30) == 1.5     # 7h30
        assert m.hour_factor(8 * 60 + 59) == 1.5     # 8h59

    def test_end_is_exclusive(self):
        m = TrafficModel(hour_buckets=[HourBucket(start=7, end=9, factor=1.5)])
        assert m.hour_factor(9 * 60) == 1.0  # 9h00 đã ra khỏi bucket

    def test_no_match_returns_1(self):
        m = TrafficModel(hour_buckets=[HourBucket(start=7, end=9, factor=1.5)])
        assert m.hour_factor(15 * 60) == 1.0


class TestDowFactor:
    def test_dow_hint_minus_1_returns_1(self):
        m = TrafficModel(dow={1: 1.2})  # dow_hint không set
        assert m.dow_factor() == 1.0

    def test_match_dow(self):
        m = TrafficModel(dow={1: 1.3}, dow_hint=1)  # Thứ 2
        assert m.dow_factor() == 1.3

    def test_unknown_dow_returns_1(self):
        m = TrafficModel(dow={1: 1.3}, dow_hint=5)  # không có trong dict
        assert m.dow_factor() == 1.0


class TestZoneFactor:
    def test_match_within_zone(self):
        m = TrafficModel(zones=[ZoneBucket(type="urban", from_km=0, to_km=10, factor=1.4)])
        assert m.zone_factor(5.0) == 1.4

    def test_to_km_exclusive(self):
        m = TrafficModel(zones=[ZoneBucket(type="urban", from_km=0, to_km=10, factor=1.4)])
        assert m.zone_factor(10.0) == 1.0

    def test_no_match_returns_1(self):
        m = TrafficModel(zones=[ZoneBucket(type="urban", from_km=0, to_km=10, factor=1.4)])
        assert m.zone_factor(50.0) == 1.0


class TestTotalFactor:
    def test_multiplies_all_3(self):
        m = TrafficModel(
            hour_buckets=[HourBucket(start=7, end=9, factor=1.5)],
            dow={1: 1.2}, dow_hint=1,
            zones=[ZoneBucket(type="urban", from_km=0, to_km=10, factor=1.4)]
        )
        # 1.5 × 1.2 × 1.4 = 2.52
        assert abs(m.total_factor(8 * 60, 5.0) - 2.52) < 1e-9


class TestFromDict:
    def test_empty_payload_yields_empty_model(self):
        m = TrafficModel.from_dict(None)
        assert m.hour_buckets == []
        assert m.dow == {}

    def test_full_payload(self):
        payload = {
            "hourBuckets": [{"start": 7, "end": 9, "factor": 1.5}],
            "dow": {"1": 1.2, "5": 1.1},
            "zones": [{"type": "urban", "fromKm": 0, "toKm": 10, "factor": 1.4}],
            "dowHint": 1
        }
        m = TrafficModel.from_dict(payload)
        assert len(m.hour_buckets) == 1
        assert m.hour_buckets[0].factor == 1.5
        assert m.dow == {1: 1.2, 5: 1.1}
        assert m.dow_hint == 1
        assert len(m.zones) == 1
        assert m.zones[0].from_km == 0.0

"""TrafficModel — áp dụng hệ số tắc đường empirical vào thời gian di chuyển.

Mô hình hoàn toàn miễn phí (không gọi API ngoài). Backend Node.js build bảng
hệ số (từ DB TrafficFactor) và gửi sang trong request. Optimizer áp dụng:

    travel_time_min(distance_km, depart_hour, dow, dist_from_depot_km)
        = (distance_km / avg_speed_kmh) * 60
        × hour_factor(depart_hour)
        × dow_factor(dow)
        × zone_factor(dist_from_depot_km)

Áp dụng trong `output.py` khi tính `plannedArrival` cho mỗi điểm. Thuật toán
HGS vẫn tối ưu trên khoảng cách thuần (chuẩn VRP) — traffic chỉ ảnh hưởng
ETA hiển thị, đảm bảo planner thấy thời gian thực tế khi review plan.
"""
from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class HourBucket:
    start: int
    end:   int       # exclusive
    factor: float


@dataclass
class ZoneBucket:
    type:   str
    from_km: float
    to_km:   float
    factor:  float


@dataclass
class TrafficModel:
    """Bảng hệ số 3 chiều. Tất cả tuỳ chọn — empty → factor = 1.0 cho chiều đó."""
    hour_buckets: list[HourBucket] = field(default_factory=list)
    dow:          dict[int, float] = field(default_factory=dict)
    zones:        list[ZoneBucket] = field(default_factory=list)
    # dow_hint = thứ trong tuần dự kiến của ngày lập kế hoạch (0=CN..6=T7).
    dow_hint:     int = -1

    def hour_factor(self, depart_min: float) -> float:
        if not self.hour_buckets:
            return 1.0
        h = int(depart_min // 60) % 24
        for b in self.hour_buckets:
            if b.start <= h < b.end:
                return b.factor
        return 1.0

    def dow_factor(self) -> float:
        if self.dow_hint < 0:
            return 1.0
        return float(self.dow.get(self.dow_hint, 1.0))

    def zone_factor(self, dist_from_depot_km: float) -> float:
        if not self.zones:
            return 1.0
        for z in self.zones:
            if z.from_km <= dist_from_depot_km < z.to_km:
                return z.factor
        return 1.0

    def total_factor(self, depart_min: float, dist_from_depot_km: float) -> float:
        return self.hour_factor(depart_min) * self.dow_factor() * self.zone_factor(dist_from_depot_km)

    @classmethod
    def from_dict(cls, payload: dict | None) -> "TrafficModel":
        if not payload:
            return cls()
        hours = [HourBucket(start=int(b["start"]), end=int(b["end"]), factor=float(b["factor"]))
                 for b in payload.get("hourBuckets", [])]
        dow_in = payload.get("dow", {}) or {}
        dow = {int(k): float(v) for k, v in dow_in.items()}
        zones = [ZoneBucket(type=str(z.get("type", "")), from_km=float(z["fromKm"]),
                            to_km=float(z["toKm"]), factor=float(z["factor"]))
                 for z in payload.get("zones", [])]
        dow_hint = int(payload.get("dowHint", -1))
        return cls(hour_buckets=hours, dow=dow, zones=zones, dow_hint=dow_hint)

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Stop:
    customer_code: str
    customer_name: str
    address: str
    lat: float
    lng: float
    weight: float
    volume: float
    service_time: int
    orders: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class Vehicle:
    id: str
    code: str
    max_weight: float
    max_volume: float


@dataclass
class Problem:
    depot_lat: float
    depot_lng: float
    stops: list[Stop]
    vehicles: list[Vehicle]
    avg_speed_kmh: float = 40.0
    depart_minutes: int = 480

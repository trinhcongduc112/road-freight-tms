"""Convert an Individual into the same JSON shape Node.js expects.

ETA của mỗi điểm = giờ khởi hành + Σ(travel_time × traffic_factor) + service_time.
Traffic factor đến từ Problem.traffic (TrafficModel) — empty thì factor = 1.0.
"""
from __future__ import annotations
import numpy as np

from .types import Problem
from .individual import Individual, route_distance
from .distance import minutes_to_hhmm


def _travel_minutes(problem: Problem, edge_km: float, depart_min: float) -> float:
    """Thời gian di chuyển 1 cạnh (phút), có áp dụng traffic factor.

    `depart_min` = thời điểm bắt đầu di chuyển (phút từ 00:00) — dùng tra hour bucket.
    `edge_km` = khoảng cách cạnh.
    Zone factor dựa trên độ dài cạnh xấp xỉ độ "xa kho" (đơn giản & ổn định cho
    bài toán radial từ depot).
    """
    base = (edge_km / max(1.0, problem.avg_speed_kmh)) * 60.0
    if problem.traffic is None:
        return base
    factor = problem.traffic.total_factor(depart_min=depart_min, dist_from_depot_km=edge_km)
    return base * factor


def build_output(ind: Individual,
                 dist: np.ndarray,
                 problem: Problem) -> list[dict]:
    out = []
    for v, route in enumerate(ind.routes):
        if not route:
            continue
        veh = problem.vehicles[v]
        time = float(problem.depart_minutes)
        prev = 0
        stops_built = []
        for si, c in enumerate(route):
            stop = problem.stops[c - 1]
            edge_km = float(dist[prev, c])
            time += _travel_minutes(problem, edge_km, depart_min=time)
            arrival = minutes_to_hhmm(time)
            time += stop.service_time
            prev = c
            stops_built.append({
                "customerCode": stop.customer_code,
                "customerName": stop.customer_name,
                "address": stop.address,
                "lat": stop.lat,
                "lng": stop.lng,
                "weight": stop.weight,
                "volume": stop.volume,
                "serviceTime": stop.service_time,
                "orders": stop.orders,
                "stopIndex": si + 1,
                "plannedArrival": arrival,
            })

        rd = route_distance(route, dist)
        out.append({
            "vehicleID": veh.id,
            "vehicleCode": veh.code,
            "stops": stops_built,
            "totalDistance": round(rd * 10) / 10,
            "totalWeight": round(ind.weights[v] * 100) / 100,
            "totalVolume": round(ind.volumes[v] * 1000) / 1000,
        })
    return out

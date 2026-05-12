"""Convert an Individual into the same JSON shape Node.js expects."""
from __future__ import annotations
import numpy as np

from .types import Problem
from .individual import Individual, route_distance
from .distance import minutes_to_hhmm


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
            time += (dist[prev, c] / problem.avg_speed_kmh) * 60.0
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

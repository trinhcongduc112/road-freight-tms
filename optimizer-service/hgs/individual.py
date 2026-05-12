from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, FrozenSet
import numpy as np

from .types import Problem


@dataclass
class Individual:
    """One candidate solution.

    routes[v] = list of stop indices (1..n), depot (0) implicit at start/end.
    Loads cached for fast feasibility checks.
    `pairs_cache` = unordered consecutive customer pairs, used for diversity.
    """
    routes: list[list[int]]
    weights: list[float] = field(default_factory=list)
    volumes: list[float] = field(default_factory=list)
    distance: float = 0.0
    excess_weight: float = 0.0
    excess_volume: float = 0.0
    fitness: float = 0.0
    pairs_cache: Optional[frozenset] = None

    def is_feasible(self) -> bool:
        return self.excess_weight <= 1e-6 and self.excess_volume <= 1e-6

    def assignment_signature(self) -> tuple:
        """Stable hash of customer -> vehicle mapping (vehicle-permutation invariant)."""
        sig = []
        for v, r in enumerate(self.routes):
            for c in r:
                sig.append((c, v))
        return tuple(sorted(sig))


def evaluate(ind: Individual,
             dist: np.ndarray,
             problem: Problem,
             penalty_w: float,
             penalty_v: float) -> None:
    """Compute distance + excess loads + penalised fitness in place."""
    total_d = 0.0
    weights, volumes = [], []
    excess_w, excess_v = 0.0, 0.0

    for v, route in enumerate(ind.routes):
        veh = problem.vehicles[v]
        if not route:
            weights.append(0.0)
            volumes.append(0.0)
            continue

        d = dist[0, route[0]]
        for i in range(len(route) - 1):
            d += dist[route[i], route[i + 1]]
        d += dist[route[-1], 0]
        total_d += d

        w = sum(problem.stops[c - 1].weight for c in route)
        vol = sum(problem.stops[c - 1].volume for c in route)
        weights.append(w)
        volumes.append(vol)

        if veh.max_weight > 0 and w > veh.max_weight:
            excess_w += w - veh.max_weight
        if veh.max_volume > 0 and vol > veh.max_volume:
            excess_v += vol - veh.max_volume

    ind.distance = total_d
    ind.weights = weights
    ind.volumes = volumes
    ind.excess_weight = excess_w
    ind.excess_volume = excess_v
    ind.fitness = total_d + penalty_w * excess_w + penalty_v * excess_v
    ind.pairs_cache = None  # invalidate


def route_distance(route: list[int], dist: np.ndarray) -> float:
    if not route:
        return 0.0
    d = dist[0, route[0]]
    for i in range(len(route) - 1):
        d += dist[route[i], route[i + 1]]
    d += dist[route[-1], 0]
    return d


def clone(ind: Individual) -> Individual:
    return Individual(
        routes=[r[:] for r in ind.routes],
        weights=ind.weights[:],
        volumes=ind.volumes[:],
        distance=ind.distance,
        excess_weight=ind.excess_weight,
        excess_volume=ind.excess_volume,
        fitness=ind.fitness,
    )

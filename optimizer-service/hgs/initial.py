"""Initial-population constructors."""
from __future__ import annotations
import random
import numpy as np

from .types import Problem
from .individual import Individual


def cheapest_insertion(problem: Problem,
                       dist: np.ndarray,
                       randomise: bool = False) -> Individual:
    """Cheapest insertion seeded by furthest customer per vehicle.
    If randomise=True, pick from top-k cheapest insertions (regret-style)."""
    n = len(problem.stops)
    K = len(problem.vehicles)
    routes: list[list[int]] = [[] for _ in range(K)]
    weights = [0.0] * K
    volumes = [0.0] * K
    assigned = [False] * (n + 1)

    # Seed each vehicle with the furthest unassigned customer it can carry
    by_dist = sorted(range(1, n + 1), key=lambda i: -dist[0, i])
    for v in range(K):
        veh = problem.vehicles[v]
        for c in by_dist:
            if assigned[c]:
                continue
            stop = problem.stops[c - 1]
            if veh.max_weight > 0 and stop.weight > veh.max_weight:
                continue
            if veh.max_volume > 0 and stop.volume > veh.max_volume:
                continue
            routes[v].append(c)
            weights[v] += stop.weight
            volumes[v] += stop.volume
            assigned[c] = True
            break

    unassigned = [c for c in range(1, n + 1) if not assigned[c]]
    if randomise:
        random.shuffle(unassigned)

    if randomise:
        # O(n × K × n_route): take customers in random order, cheapest position only
        for c in unassigned:
            stop = problem.stops[c - 1]
            best = None  # (delta, v, pos)
            for v in range(K):
                veh = problem.vehicles[v]
                if veh.max_weight > 0 and weights[v] + stop.weight > veh.max_weight:
                    continue
                if veh.max_volume > 0 and volumes[v] + stop.volume > veh.max_volume:
                    continue
                rt = routes[v]
                for pos in range(len(rt) + 1):
                    prev = 0 if pos == 0 else rt[pos - 1]
                    nxt = 0 if pos == len(rt) else rt[pos]
                    delta = dist[prev, c] + dist[c, nxt] - dist[prev, nxt]
                    if best is None or delta < best[0]:
                        best = (delta, v, pos)
            if best is None:
                v = min(range(K), key=lambda i: weights[i])
                routes[v].append(c)
                weights[v] += stop.weight
                volumes[v] += stop.volume
            else:
                _, v, pos = best
                routes[v].insert(pos, c)
                weights[v] += stop.weight
                volumes[v] += stop.volume
    else:
        # Deterministic cheapest insertion: at every step pick the (customer, position)
        # with globally minimal delta. O(n²K) total via incremental caching.
        unassigned_set = set(unassigned)
        while unassigned_set:
            best = None  # (delta, c, v, pos)
            for c in unassigned_set:
                stop = problem.stops[c - 1]
                for v in range(K):
                    veh = problem.vehicles[v]
                    if veh.max_weight > 0 and weights[v] + stop.weight > veh.max_weight:
                        continue
                    if veh.max_volume > 0 and volumes[v] + stop.volume > veh.max_volume:
                        continue
                    rt = routes[v]
                    for pos in range(len(rt) + 1):
                        prev = 0 if pos == 0 else rt[pos - 1]
                        nxt = 0 if pos == len(rt) else rt[pos]
                        delta = dist[prev, c] + dist[c, nxt] - dist[prev, nxt]
                        if best is None or delta < best[0]:
                            best = (delta, c, v, pos)
            if best is None:
                c = next(iter(unassigned_set))
                v = min(range(K), key=lambda i: weights[i])
                routes[v].append(c)
                weights[v] += problem.stops[c - 1].weight
                volumes[v] += problem.stops[c - 1].volume
                unassigned_set.discard(c)
            else:
                _, c, v, pos = best
                routes[v].insert(pos, c)
                weights[v] += problem.stops[c - 1].weight
                volumes[v] += problem.stops[c - 1].volume
                unassigned_set.discard(c)

    return Individual(routes=routes, weights=weights, volumes=volumes)


def random_split(problem: Problem) -> Individual:
    """Random scattering — used for diversity in initial population."""
    n = len(problem.stops)
    K = len(problem.vehicles)
    routes: list[list[int]] = [[] for _ in range(K)]
    customers = list(range(1, n + 1))
    random.shuffle(customers)

    # Round-robin onto vehicles trying to respect capacity
    weights = [0.0] * K
    volumes = [0.0] * K
    for c in customers:
        stop = problem.stops[c - 1]
        # Pick vehicle with most slack
        best = -1
        best_slack = -1.0
        for v in range(K):
            veh = problem.vehicles[v]
            wmax = veh.max_weight if veh.max_weight > 0 else 1e18
            vmax = veh.max_volume if veh.max_volume > 0 else 1e18
            if weights[v] + stop.weight > wmax:
                continue
            if volumes[v] + stop.volume > vmax:
                continue
            slack = (wmax - weights[v] - stop.weight)
            if slack > best_slack:
                best_slack = slack
                best = v
        if best < 0:
            best = min(range(K), key=lambda i: weights[i])
        routes[best].append(c)
        weights[best] += stop.weight
        volumes[best] += stop.volume

    return Individual(routes=routes, weights=weights, volumes=volumes)

"""SREX (Selective Route Exchange) crossover for HGS — list-of-routes form.

1. From parent A, copy a random subset of routes wholesale.
2. Remove all customers in those copied routes from parent B's routes.
3. Append B's remaining routes (with their order preserved) to fill the
   remaining vehicles.
4. Re-insert any customers still missing using cheapest insertion.
"""
from __future__ import annotations
import random
import numpy as np

from .types import Problem
from .individual import Individual


def srex_crossover(parent_a: Individual,
                   parent_b: Individual,
                   problem: Problem,
                   dist: np.ndarray) -> Individual:
    K = len(problem.vehicles)
    n = len(problem.stops)

    # Pick how many routes to take from A
    nonempty_a = [v for v in range(K) if parent_a.routes[v]]
    if not nonempty_a:
        return Individual(routes=[r[:] for r in parent_b.routes])
    n_take = random.randint(1, max(1, len(nonempty_a) - 1)) if len(nonempty_a) > 1 else 1
    taken_from_a = set(random.sample(nonempty_a, n_take))

    child_routes: list[list[int]] = [[] for _ in range(K)]
    used_customers: set[int] = set()

    # Step 1: copy chosen routes from A
    for v in taken_from_a:
        child_routes[v] = parent_a.routes[v][:]
        used_customers.update(child_routes[v])

    # Step 2 & 3: fill remaining vehicles from B's routes (skip already-used customers)
    free_slots = [v for v in range(K) if v not in taken_from_a]
    b_routes = [r[:] for r in parent_b.routes]

    for slot, br_idx in zip(free_slots, range(K)):
        # Use parent B's route at index br_idx, dropping used customers
        cleaned = [c for c in b_routes[br_idx] if c not in used_customers]
        child_routes[slot] = cleaned
        used_customers.update(cleaned)

    # Step 4: any customer 1..n still missing → cheapest insertion
    missing = [c for c in range(1, n + 1) if c not in used_customers]
    random.shuffle(missing)

    weights = [sum(problem.stops[c - 1].weight for c in r) for r in child_routes]
    volumes = [sum(problem.stops[c - 1].volume for c in r) for r in child_routes]

    for c in missing:
        stop = problem.stops[c - 1]
        best = None  # (delta, vehicle, pos)
        for v in range(K):
            r = child_routes[v]
            for pos in range(len(r) + 1):
                p_prev = 0 if pos == 0 else r[pos - 1]
                p_next = 0 if pos == len(r) else r[pos]
                delta = dist[p_prev, c] + dist[c, p_next] - dist[p_prev, p_next]
                # Capacity-aware tie-breaking (prefer feasible insertions)
                veh = problem.vehicles[v]
                penalty = 0.0
                if veh.max_weight > 0 and weights[v] + stop.weight > veh.max_weight:
                    penalty += 1000.0  # discourage but allow
                if veh.max_volume > 0 and volumes[v] + stop.volume > veh.max_volume:
                    penalty += 1000.0
                score = delta + penalty
                if best is None or score < best[0]:
                    best = (score, v, pos)

        if best is None:
            child_routes[0].append(c)
            weights[0] += stop.weight
            volumes[0] += stop.volume
        else:
            _, v, pos = best
            child_routes[v].insert(pos, c)
            weights[v] += stop.weight
            volumes[v] += stop.volume

    return Individual(routes=child_routes, weights=weights, volumes=volumes)

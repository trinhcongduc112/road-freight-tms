"""Baselines for benchmarking against HGS.

- optimize_nn2opt: Nearest Neighbour + 2-opt   (Abivin-style)
- optimize_lns_sa: Furthest Seed + Cheapest Insertion
                   + Or-opt + Relocate + Swap
                   + Shaw Removal / Greedy Reinsertion (LNS)
                   + Simulated Annealing acceptance
"""
from __future__ import annotations
import math
import random
import numpy as np

from .types import Problem
from .distance import build_distance_matrix
from .individual import Individual, evaluate, clone
from .education import two_opt, or_opt, relocate_inter, swap_inter, intra_route_search
from .initial import cheapest_insertion


# ---------------------------------------------------------------------- NN+2opt

def _nearest_neighbor_construct(problem: Problem, dist: np.ndarray) -> Individual:
    n = len(problem.stops)
    K = len(problem.vehicles)
    routes: list[list[int]] = [[] for _ in range(K)]
    weights = [0.0] * K
    volumes = [0.0] * K
    assigned = [False] * (n + 1)

    sorted_seeds = sorted(range(1, n + 1), key=lambda i: -dist[0, i])
    v_cur = 0
    for seed in sorted_seeds:
        if assigned[seed]:
            continue
        placed = False
        for attempt in range(K):
            v = (v_cur + attempt) % K
            stop = problem.stops[seed - 1]
            veh = problem.vehicles[v]
            if veh.max_weight > 0 and weights[v] + stop.weight > veh.max_weight:
                continue
            if veh.max_volume > 0 and volumes[v] + stop.volume > veh.max_volume:
                continue
            routes[v].append(seed)
            weights[v] += stop.weight
            volumes[v] += stop.volume
            assigned[seed] = True
            placed = True
            break
        if not placed:
            routes[0].append(seed)
            weights[0] += problem.stops[seed - 1].weight
            volumes[0] += problem.stops[seed - 1].volume
            assigned[seed] = True
    return Individual(routes=routes, weights=weights, volumes=volumes)


def optimize_nn2opt(problem: Problem) -> tuple[Individual, np.ndarray, dict]:
    points = [(problem.depot_lat, problem.depot_lng)]
    points += [(s.lat, s.lng) for s in problem.stops]
    dist = build_distance_matrix(points)

    if not problem.stops or not problem.vehicles:
        return Individual(routes=[]), dist, {}

    ind = _nearest_neighbor_construct(problem, dist)
    for r in ind.routes:
        if len(r) >= 2:
            two_opt(r, dist)
    evaluate(ind, dist, problem, penalty_w=1.0, penalty_v=1.0)
    return ind, dist, {"algo": "nn2opt"}


# ---------------------------------------------------------------------- LNS+SA

def _shaw_removal(ind: Individual, problem: Problem, dist: np.ndarray, n_remove: int) -> list[int]:
    pool = []
    for v, r in enumerate(ind.routes):
        for c in r:
            pool.append((c, v))
    if not pool:
        return []
    pivot_item = random.choice(pool)
    pivot = pivot_item[0]
    others = [p for p in pool if p is not pivot_item]
    others.sort(key=lambda p: dist[pivot, p[0]])
    target = [pivot_item] + others[: n_remove - 1]

    removed = []
    for c, v in target:
        if c in ind.routes[v]:
            ind.routes[v].remove(c)
            stop = problem.stops[c - 1]
            ind.weights[v] -= stop.weight
            ind.volumes[v] -= stop.volume
            removed.append(c)
    return removed


def _greedy_reinsert(ind: Individual, problem: Problem, dist: np.ndarray, removed: list[int]) -> None:
    pool = list(removed)
    while pool:
        best = None  # (delta, idx, v, pos)
        for k, c in enumerate(pool):
            stop = problem.stops[c - 1]
            for v, r in enumerate(ind.routes):
                veh = problem.vehicles[v]
                if veh.max_weight > 0 and ind.weights[v] + stop.weight > veh.max_weight:
                    continue
                if veh.max_volume > 0 and ind.volumes[v] + stop.volume > veh.max_volume:
                    continue
                for pos in range(len(r) + 1):
                    p_prev = 0 if pos == 0 else r[pos - 1]
                    p_next = 0 if pos == len(r) else r[pos]
                    delta = dist[p_prev, c] + dist[c, p_next] - dist[p_prev, p_next]
                    if best is None or delta < best[0]:
                        best = (delta, k, v, pos)
        if best is None:
            c = pool.pop(0)
            v = min(range(len(ind.routes)), key=lambda i: ind.weights[i])
            ind.routes[v].append(c)
            ind.weights[v] += problem.stops[c - 1].weight
            ind.volumes[v] += problem.stops[c - 1].volume
        else:
            _, k, v, pos = best
            c = pool[k]
            ind.routes[v].insert(pos, c)
            ind.weights[v] += problem.stops[c - 1].weight
            ind.volumes[v] += problem.stops[c - 1].volume
            pool.pop(k)


def optimize_lns_sa(problem: Problem,
                    max_iters: int | None = None,
                    seed: int | None = None) -> tuple[Individual, np.ndarray, dict]:
    if seed is not None:
        random.seed(seed)
        np.random.seed(seed)

    points = [(problem.depot_lat, problem.depot_lng)]
    points += [(s.lat, s.lng) for s in problem.stops]
    dist = build_distance_matrix(points)

    if not problem.stops or not problem.vehicles:
        return Individual(routes=[]), dist, {}

    ind = cheapest_insertion(problem, dist, randomise=False)
    evaluate(ind, dist, problem, 1e6, 1e6)
    intra_route_search(ind, dist)
    relocate_inter(ind, dist, problem, 1e6, 1e6)
    swap_inter(ind, dist, problem, 1e6, 1e6)
    evaluate(ind, dist, problem, 1e6, 1e6)

    n = len(problem.stops)
    iterations = max_iters if max_iters else min(800, max(150, n * 12))
    remove_min = max(2, int(n * 0.05))
    remove_max = max(remove_min, min(int(n * 0.25), 10))
    T0 = 2.0
    cool = math.exp(math.log(0.01) / iterations)

    cur = clone(ind)
    best = clone(ind)
    cur_cost = cur.distance
    best_cost = best.distance
    T = T0

    for _ in range(iterations):
        cand = clone(cur)
        n_remove = random.randint(remove_min, remove_max)
        removed = _shaw_removal(cand, problem, dist, n_remove)
        _greedy_reinsert(cand, problem, dist, removed)

        for r in cand.routes:
            if len(r) >= 2:
                two_opt(r, dist)
            if r:
                or_opt(r, dist, 1)
        evaluate(cand, dist, problem, 1e6, 1e6)

        delta = cand.distance - cur_cost
        if delta < 0 or random.random() < math.exp(-delta / T):
            cur = cand
            cur_cost = cand.distance
            if cur_cost < best_cost:
                best = clone(cur)
                best_cost = cur_cost
        T *= cool

    intra_route_search(best, dist)
    relocate_inter(best, dist, problem, 1e6, 1e6)
    swap_inter(best, dist, problem, 1e6, 1e6)
    intra_route_search(best, dist)
    evaluate(best, dist, problem, 1e6, 1e6)
    return best, dist, {"algo": "lns-sa", "iterations": iterations}

"""Education = local-search intensification on a single individual.

Operators:
- 2-opt    (intra-route)
- Or-opt   (intra-route, segment lengths 1,2,3)
- Relocate (inter-route, single customer)
- Swap     (inter-route, exchange of 2 customers)

All inter-route moves use a delta-cost evaluation including capacity penalty
so the operator naturally respects the current dynamic penalty regime.
"""
from __future__ import annotations
import numpy as np

from .types import Problem
from .individual import Individual, evaluate


def _excess_delta(load: float, change: float, cap: float) -> float:
    """How much excess-load changes when 'change' is added to a vehicle at 'load' (cap=0 means unconstrained)."""
    if cap <= 0:
        return 0.0
    old = max(0.0, load - cap)
    new = max(0.0, load + change - cap)
    return new - old


def two_opt(route: list[int], dist: np.ndarray) -> bool:
    n = len(route)
    if n < 3:
        return False
    improved_any = False
    improved = True
    while improved:
        improved = False
        n = len(route)
        for i in range(n - 1):
            a = 0 if i == 0 else route[i - 1]
            b = route[i]
            for j in range(i + 1, n):
                c = route[j]
                d = 0 if j == n - 1 else route[j + 1]
                delta = dist[a, c] + dist[b, d] - dist[a, b] - dist[c, d]
                if delta < -1e-9:
                    route[i:j + 1] = route[i:j + 1][::-1]
                    improved = True
                    improved_any = True
                    break
            if improved:
                break
    return improved_any


def or_opt(route: list[int], dist: np.ndarray, seg_len: int) -> bool:
    """Move a contiguous segment of length seg_len to a better position."""
    if len(route) <= seg_len:
        return False
    improved_any = False
    improved = True
    while improved:
        improved = False
        n = len(route)
        for i in range(n - seg_len + 1):
            seg = route[i:i + seg_len]
            before = 0 if i == 0 else route[i - 1]
            after = 0 if i + seg_len >= n else route[i + seg_len]
            remove_save = dist[before, seg[0]] + dist[seg[-1], after] - dist[before, after]
            rest = route[:i] + route[i + seg_len:]

            best_pos = -1
            best_gain = 1e-9
            for pos in range(len(rest) + 1):
                if pos == i:
                    continue
                p_before = 0 if pos == 0 else rest[pos - 1]
                p_after = 0 if pos == len(rest) else rest[pos]
                insert_cost = dist[p_before, seg[0]] + dist[seg[-1], p_after] - dist[p_before, p_after]
                gain = remove_save - insert_cost
                if gain > best_gain:
                    best_gain = gain
                    best_pos = pos

            if best_pos >= 0:
                route.clear()
                route.extend(rest[:best_pos] + seg + rest[best_pos:])
                improved = True
                improved_any = True
                break
    return improved_any


def intra_route_search(ind: Individual, dist: np.ndarray) -> bool:
    any_imp = False
    for r in ind.routes:
        if len(r) < 2:
            continue
        if two_opt(r, dist):
            any_imp = True
        if or_opt(r, dist, 1):
            any_imp = True
        if len(r) >= 3 and or_opt(r, dist, 2):
            any_imp = True
        if len(r) >= 4 and or_opt(r, dist, 3):
            any_imp = True
    return any_imp


def relocate_inter(ind: Individual, dist: np.ndarray, problem: Problem,
                   penalty_w: float, penalty_v: float) -> bool:
    routes = ind.routes
    weights = ind.weights
    volumes = ind.volumes
    K = len(routes)
    any_imp = False
    improved = True
    while improved:
        improved = False
        moved = False
        for ra in range(K):
            if moved:
                break
            ra_route = routes[ra]
            i = 0
            while i < len(ra_route):
                c = ra_route[i]
                stop = problem.stops[c - 1]
                prev_a = 0 if i == 0 else ra_route[i - 1]
                next_a = 0 if i == len(ra_route) - 1 else ra_route[i + 1]
                remove_save = dist[prev_a, c] + dist[c, next_a] - dist[prev_a, next_a]

                veh_a = problem.vehicles[ra]
                xa_w = _excess_delta(weights[ra], -stop.weight, veh_a.max_weight)
                xa_v = _excess_delta(volumes[ra], -stop.volume, veh_a.max_volume)

                best = None  # (delta, rb, pos)
                for rb in range(K):
                    if rb == ra:
                        continue
                    veh_b = problem.vehicles[rb]
                    xb_w = _excess_delta(weights[rb], stop.weight, veh_b.max_weight)
                    xb_v = _excess_delta(volumes[rb], stop.volume, veh_b.max_volume)
                    excess_delta = (xa_w + xb_w) * penalty_w + (xa_v + xb_v) * penalty_v

                    rb_route = routes[rb]
                    for pos in range(len(rb_route) + 1):
                        p_prev = 0 if pos == 0 else rb_route[pos - 1]
                        p_next = 0 if pos == len(rb_route) else rb_route[pos]
                        insert_cost = dist[p_prev, c] + dist[c, p_next] - dist[p_prev, p_next]
                        total = (insert_cost - remove_save) + excess_delta
                        if total < -1e-9 and (best is None or total < best[0]):
                            best = (total, rb, pos)

                if best is not None:
                    _, rb, pos = best
                    ra_route.pop(i)
                    routes[rb].insert(pos, c)
                    weights[ra] -= stop.weight
                    volumes[ra] -= stop.volume
                    weights[rb] += stop.weight
                    volumes[rb] += stop.volume
                    improved = True
                    any_imp = True
                    moved = True
                    break
                else:
                    i += 1
    return any_imp


def swap_inter(ind: Individual, dist: np.ndarray, problem: Problem,
               penalty_w: float, penalty_v: float) -> bool:
    routes = ind.routes
    weights = ind.weights
    volumes = ind.volumes
    K = len(routes)
    any_imp = False
    improved = True
    while improved:
        improved = False
        outer = False
        for ra in range(K - 1):
            if outer:
                break
            for i in range(len(routes[ra])):
                if outer:
                    break
                ca = routes[ra][i]
                stop_a = problem.stops[ca - 1]
                prev_a = 0 if i == 0 else routes[ra][i - 1]
                next_a = 0 if i == len(routes[ra]) - 1 else routes[ra][i + 1]
                veh_a = problem.vehicles[ra]

                for rb in range(ra + 1, K):
                    if outer:
                        break
                    veh_b = problem.vehicles[rb]
                    for j in range(len(routes[rb])):
                        cb = routes[rb][j]
                        stop_b = problem.stops[cb - 1]
                        prev_b = 0 if j == 0 else routes[rb][j - 1]
                        next_b = 0 if j == len(routes[rb]) - 1 else routes[rb][j + 1]

                        old = dist[prev_a, ca] + dist[ca, next_a] + dist[prev_b, cb] + dist[cb, next_b]
                        new = dist[prev_a, cb] + dist[cb, next_a] + dist[prev_b, ca] + dist[ca, next_b]
                        delta_dist = new - old

                        dw_a = stop_b.weight - stop_a.weight
                        dv_a = stop_b.volume - stop_a.volume
                        xa_w = _excess_delta(weights[ra], dw_a, veh_a.max_weight)
                        xa_v = _excess_delta(volumes[ra], dv_a, veh_a.max_volume)
                        xb_w = _excess_delta(weights[rb], -dw_a, veh_b.max_weight)
                        xb_v = _excess_delta(volumes[rb], -dv_a, veh_b.max_volume)
                        excess_delta = (xa_w + xb_w) * penalty_w + (xa_v + xb_v) * penalty_v

                        if delta_dist + excess_delta < -1e-9:
                            routes[ra][i] = cb
                            routes[rb][j] = ca
                            weights[ra] += dw_a
                            volumes[ra] += dv_a
                            weights[rb] -= dw_a
                            volumes[rb] -= dv_a
                            improved = True
                            any_imp = True
                            outer = True
                            break
    return any_imp


def educate(ind: Individual, dist: np.ndarray, problem: Problem,
            penalty_w: float, penalty_v: float, *, light: bool = False) -> None:
    """Run local-search intensification on the individual.

    light=True  -> 1 pass, intra + relocate only (used inside the GA loop on
                   large instances where swap_inter is the bottleneck).
    light=False -> up to 4 passes alternating intra/relocate/swap (used for
                   initial population and final intensification on the best).
    """
    if light:
        intra_route_search(ind, dist)
        relocate_inter(ind, dist, problem, penalty_w, penalty_v)
        intra_route_search(ind, dist)
    else:
        for _ in range(4):
            c1 = intra_route_search(ind, dist)
            c2 = relocate_inter(ind, dist, problem, penalty_w, penalty_v)
            c3 = swap_inter(ind, dist, problem, penalty_w, penalty_v)
            if not (c1 or c2 or c3):
                break
    evaluate(ind, dist, problem, penalty_w, penalty_v)

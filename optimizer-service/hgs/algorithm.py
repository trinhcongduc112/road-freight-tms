"""Main HGS-CVRP loop.

Phase A — Initialise population:
  - Half cheapest-insertion (deterministic seed + 4*mu randomised variants).
  - Half random-split for diversity.
  - Each individual is educated (local search) before insertion.

Phase B — Generational loop (until iteration budget or stagnation):
  1. Select two parents by binary tournament on biased fitness.
  2. SREX crossover -> child.
  3. Educate child.
  4. Insert into feasible / infeasible sub-population (cull duplicates if full).
  5. Adjust capacity-violation penalties to keep ~20-30% individuals feasible.

Returns the best feasible individual (or best overall if none feasible).
"""
from __future__ import annotations
import random
import time
import numpy as np

from .types import Problem
from .distance import build_distance_matrix
from .individual import Individual, evaluate, clone
from .initial import cheapest_insertion, random_split
from .education import educate
from .crossover import srex_crossover
from .population import Population


def optimize_hgs(problem: Problem,
                 max_iters: int = 5000,
                 max_seconds: float = 10.0,
                 stagnation_limit: int = 400,
                 seed: int | None = None) -> tuple[Individual, np.ndarray, dict]:
    if seed is not None:
        random.seed(seed)
        np.random.seed(seed)

    # ----- distance matrix
    points = [(problem.depot_lat, problem.depot_lng)]
    points += [(s.lat, s.lng) for s in problem.stops]
    dist = build_distance_matrix(points)

    n = len(problem.stops)
    if n == 0 or len(problem.vehicles) == 0:
        return Individual(routes=[]), dist, {"iterations": 0}

    # Penalty starts low; population manager adjusts it adaptively
    avg_edge = float(dist[dist > 0].mean()) if (dist > 0).any() else 1.0
    penalty_w = avg_edge / max(1.0, max(s.weight for s in problem.stops))
    penalty_v = avg_edge / max(0.001, max(s.volume for s in problem.stops))

    # Adapt population size to problem size — keeps init phase budget-friendly
    if n <= 30:
        mu, lam = 25, 40
    elif n <= 60:
        mu, lam = 18, 30
    else:
        mu, lam = 12, 20
    pop = Population(mu=mu, lam=lam)

    # ----- Phase A: initial population
    started = time.time()
    init_size = mu * 2
    seeds: list[Individual] = []
    seeds.append(cheapest_insertion(problem, dist, randomise=False))
    for _ in range(init_size // 2):
        seeds.append(cheapest_insertion(problem, dist, randomise=True))
    for _ in range(init_size - len(seeds)):
        seeds.append(random_split(problem))

    init_budget = max_seconds * 0.3  # cap init phase at 30% of total budget
    for ind in seeds:
        evaluate(ind, dist, problem, penalty_w, penalty_v)
        educate(ind, dist, problem, penalty_w, penalty_v)
        pop.add(ind)
        if time.time() - started > init_budget:
            break

    best = pop.best_overall()
    best = clone(best)
    best_iter = 0

    # ----- Phase B: generational loop
    stats = {"iterations": 0, "improvements": 0, "feasible_ratio_history": []}

    for it in range(max_iters):
        if time.time() - started > max_seconds:
            break
        if it - best_iter > stagnation_limit:
            # Diversification: regenerate half the population
            new_pop = Population(mu=pop.mu, lam=pop.lam)
            elites = sorted(pop.feasible + pop.infeasible, key=lambda x: x.fitness)[: pop.mu // 4]
            for e in elites:
                new_pop.add(clone(e))
            for _ in range(pop.mu):
                ind = random_split(problem)
                evaluate(ind, dist, problem, penalty_w, penalty_v)
                educate(ind, dist, problem, penalty_w, penalty_v)
                new_pop.add(ind)
            pop = new_pop
            best_iter = it

        parent_a = pop.select_parent()
        parent_b = pop.select_parent()
        if parent_a is parent_b and pop.size() > 1:
            parent_b = pop.select_parent()

        child = srex_crossover(parent_a, parent_b, problem, dist)
        evaluate(child, dist, problem, penalty_w, penalty_v)
        # Light education during the GA loop on larger instances (saves swap cost)
        educate(child, dist, problem, penalty_w, penalty_v, light=(n > 50))
        pop.add(child)

        if child.is_feasible() and child.distance < best.distance:
            best = clone(child)
            best_iter = it
            stats["improvements"] += 1

        # Adaptive penalty: target feasible ratio ~0.25
        if it % 50 == 49:
            ratio = pop.feasible_ratio()
            stats["feasible_ratio_history"].append(round(ratio, 3))
            if len(stats["feasible_ratio_history"]) > 10:
                stats["feasible_ratio_history"] = stats["feasible_ratio_history"][-10:]
            if ratio < 0.15:
                penalty_w *= 1.2
                penalty_v *= 1.2
            elif ratio > 0.35:
                penalty_w *= 0.85
                penalty_v *= 0.85

        stats["iterations"] = it + 1

    # Final intensification on best — full education with swap
    best_clone = clone(best)
    educate(best_clone, dist, problem, penalty_w, penalty_v, light=False)
    if best_clone.is_feasible() and best_clone.distance < best.distance:
        best = best_clone

    return best, dist, stats

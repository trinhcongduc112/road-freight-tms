"""Population manager for HGS.

Maintains two sub-populations: feasible and infeasible. Each sub-population
caps at `mu + lambda` individuals; on overflow, biased fitness (mix of cost
rank and diversity rank) is used to cull duplicates.

Performance: pair-set per individual is cached on first access to avoid
recomputing it for every diversity comparison.
"""
from __future__ import annotations
import random

from .individual import Individual


def _pairs(ind: Individual) -> frozenset:
    if ind.pairs_cache is None:
        s = set()
        for r in ind.routes:
            for i in range(len(r) - 1):
                a, b = r[i], r[i + 1]
                s.add((a, b) if a < b else (b, a))
        ind.pairs_cache = frozenset(s)
    return ind.pairs_cache


def broken_pairs_distance(a: Individual, b: Individual) -> float:
    pa = _pairs(a)
    pb = _pairs(b)
    union = pa | pb
    if not union:
        return 0.0
    return 1.0 - len(pa & pb) / len(union)


def _diversity_score(ind: Individual, others: list[Individual], n_close: int = 3) -> float:
    if not others:
        return 1.0
    dists = sorted(broken_pairs_distance(ind, o) for o in others)
    take = min(n_close, len(dists))
    return sum(dists[:take]) / take


def biased_fitness_ranks(bucket: list[Individual]) -> dict[int, float]:
    """Compute biased fitness for every individual in bucket. Returns dict id(ind)->score."""
    n = len(bucket)
    if n == 0:
        return {}
    if n == 1:
        return {id(bucket[0]): 0.0}

    by_fit = sorted(range(n), key=lambda i: bucket[i].fitness)
    fit_rank = [0] * n
    for r, idx in enumerate(by_fit):
        fit_rank[idx] = r

    diversity = [_diversity_score(bucket[i], [bucket[j] for j in range(n) if j != i]) for i in range(n)]
    by_div = sorted(range(n), key=lambda i: -diversity[i])
    div_rank = [0] * n
    for r, idx in enumerate(by_div):
        div_rank[idx] = r

    out = {}
    for i in range(n):
        out[id(bucket[i])] = fit_rank[i] / n + 0.6 * div_rank[i] / n
    return out


class Population:
    def __init__(self, mu: int = 25, lam: int = 40):
        self.mu = mu
        self.lam = lam
        self.feasible: list[Individual] = []
        self.infeasible: list[Individual] = []

    def add(self, ind: Individual) -> None:
        bucket = self.feasible if ind.is_feasible() else self.infeasible
        bucket.append(ind)
        if len(bucket) > self.mu + self.lam:
            self._survivor_select(bucket)

    def _survivor_select(self, bucket: list[Individual]) -> None:
        scores = biased_fitness_ranks(bucket)
        bucket.sort(key=lambda x: scores[id(x)])
        del bucket[self.mu:]

    def best_feasible(self) -> Individual | None:
        if not self.feasible:
            return None
        return min(self.feasible, key=lambda i: i.fitness)

    def best_overall(self) -> Individual:
        all_inds = self.feasible + self.infeasible
        feas = [i for i in all_inds if i.is_feasible()]
        if feas:
            return min(feas, key=lambda i: i.fitness)
        return min(all_inds, key=lambda i: i.fitness)

    def select_parent(self) -> Individual:
        """Binary tournament on combined population by raw fitness (fast).
        Diversity is enforced at survivor-selection time, not selection time.
        """
        combined = self.feasible + self.infeasible
        if len(combined) <= 1:
            return combined[0]
        a, b = random.sample(combined, 2)
        return a if a.fitness <= b.fitness else b

    def feasible_ratio(self) -> float:
        total = len(self.feasible) + len(self.infeasible)
        if total == 0:
            return 0.5
        return len(self.feasible) / total

    def size(self) -> int:
        return len(self.feasible) + len(self.infeasible)

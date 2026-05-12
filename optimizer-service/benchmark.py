"""Thesis benchmark — runs all 3 algorithms across a range of problem sizes
and prints a table suitable for inclusion in the report.

Usage:
    python benchmark.py
"""
from __future__ import annotations
import time
import random

from hgs.types import Problem, Stop, Vehicle
from hgs.algorithm import optimize_hgs
from hgs.baselines import optimize_nn2opt, optimize_lns_sa


def synth_problem(n_stops: int, n_vehicles: int, seed: int = 7) -> Problem:
    random.seed(seed)
    depot_lat, depot_lng = 10.7769, 106.7009
    stops: list[Stop] = []
    for i in range(n_stops):
        stops.append(Stop(
            customer_code=f"C{i:03d}",
            customer_name=f"KH {i}",
            address="",
            lat=depot_lat + random.uniform(-0.15, 0.15),
            lng=depot_lng + random.uniform(-0.15, 0.15),
            weight=random.uniform(50, 250),
            volume=random.uniform(0.05, 0.5),
            service_time=15,
            orders=[{"id": f"O{i:03d}", "code": f"OC{i:03d}"}],
        ))
    vehicles = [Vehicle(id=f"V{v}", code=f"V{v}", max_weight=1500, max_volume=3.0)
                for v in range(n_vehicles)]
    return Problem(depot_lat=depot_lat, depot_lng=depot_lng, stops=stops, vehicles=vehicles)


def run_one(problem: Problem, algo_name: str, runner, **kw) -> dict:
    t0 = time.time()
    ind, _, stats = runner(problem, **kw)
    elapsed = time.time() - t0
    routes_used = sum(1 for r in ind.routes if r)
    return {
        "name": algo_name, "distance": ind.distance, "feasible": ind.is_feasible(),
        "elapsed": elapsed, "routes_used": routes_used, "iterations": stats.get("iterations", "—"),
    }


def main() -> None:
    cases = [(20, 4), (30, 5), (50, 8), (80, 12), (100, 15)]
    budget = 10.0

    print("\n" + "=" * 88)
    print(f"{'Stops':>6} {'Veh':>4} | {'Algorithm':<12} | {'Cost(km)':>10} {'Feas':>5} {'Time(s)':>8} {'Iters':>7} {'vs NN':>8}")
    print("-" * 88)

    for n, K in cases:
        p = synth_problem(n, K, seed=11)
        nn = run_one(p, "NN+2opt",  lambda pp: optimize_nn2opt(pp))
        ls = run_one(p, "LNS+SA",   lambda pp: optimize_lns_sa(pp, seed=42))
        hg = run_one(p, "HGS",      lambda pp: optimize_hgs(pp, max_seconds=budget, seed=42))
        base = nn["distance"]
        for r in (nn, ls, hg):
            r["pct"] = (1 - r["distance"] / base) * 100 if base > 0 else 0.0

        for r in (nn, ls, hg):
            print(f"{n:>6} {K:>4} | {r['name']:<12} | "
                  f"{r['distance']:>10.1f} {str(r['feasible']):>5} "
                  f"{r['elapsed']:>8.2f} {str(r['iterations']):>7} "
                  f"{r['pct']:>7.1f}%")
        print("-" * 88)

    print("\nNotes:")
    print(" - All algorithms tested on identical synthetic instances around HCMC depot.")
    print(" - Capacity: 1500kg / 3.0m³ per vehicle.")
    print(" - HGS budget = 10s. NN+2opt and LNS+SA run to completion.")
    print(" - 'vs NN' = % distance saved compared to NN+2opt (Abivin-style baseline).\n")


if __name__ == "__main__":
    main()

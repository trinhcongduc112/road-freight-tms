"""Smoke test + benchmark on a synthetic 30-stop instance around Ho Chi Minh City."""
from __future__ import annotations
import random
import time

from hgs.types import Problem, Stop, Vehicle
from hgs.algorithm import optimize_hgs
from hgs.baselines import optimize_nn2opt, optimize_lns_sa


def synth_problem(n_stops: int = 30, n_vehicles: int = 5, seed: int = 7) -> Problem:
    random.seed(seed)
    # Centre = HCMC depot
    depot_lat, depot_lng = 10.7769, 106.7009
    stops: list[Stop] = []
    for i in range(n_stops):
        stops.append(Stop(
            customer_code=f"C{i:03d}",
            customer_name=f"Customer {i}",
            address=f"Address {i}",
            lat=depot_lat + random.uniform(-0.15, 0.15),
            lng=depot_lng + random.uniform(-0.15, 0.15),
            weight=random.uniform(50, 250),
            volume=random.uniform(0.05, 0.5),
            service_time=15,
            orders=[{"id": f"O{i:03d}", "code": f"OC{i:03d}"}],
        ))
    vehicles = [
        Vehicle(id=f"V{v}", code=f"V{v}", max_weight=1500, max_volume=3.0)
        for v in range(n_vehicles)
    ]
    return Problem(depot_lat=depot_lat, depot_lng=depot_lng, stops=stops, vehicles=vehicles)


def main() -> None:
    p = synth_problem(n_stops=30, n_vehicles=5, seed=7)
    print(f"Problem: {len(p.stops)} stops, {len(p.vehicles)} vehicles\n")

    print("Running NN+2opt …")
    t0 = time.time()
    ind1, _, _ = optimize_nn2opt(p)
    t1 = time.time() - t0
    print(f"  distance={ind1.distance:.2f}km  feas={ind1.is_feasible()}  t={t1*1000:.0f}ms")

    print("Running LNS+SA …")
    t0 = time.time()
    ind2, _, _ = optimize_lns_sa(p, seed=42)
    t2 = time.time() - t0
    print(f"  distance={ind2.distance:.2f}km  feas={ind2.is_feasible()}  t={t2*1000:.0f}ms")

    print("Running HGS …")
    t0 = time.time()
    ind3, _, stats = optimize_hgs(p, max_seconds=8.0, seed=42)
    t3 = time.time() - t0
    print(f"  distance={ind3.distance:.2f}km  feas={ind3.is_feasible()}  t={t3*1000:.0f}ms  iters={stats['iterations']}")

    base = ind1.distance
    print(f"\nImprovement vs NN+2opt:")
    print(f"  LNS+SA: {(1 - ind2.distance/base)*100:.1f}%")
    print(f"  HGS:    {(1 - ind3.distance/base)*100:.1f}%")


if __name__ == "__main__":
    main()

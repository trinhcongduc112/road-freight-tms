"""FastAPI service exposing the HGS-CVRP optimiser to the Node.js backend.

Endpoints:
  GET  /health          — liveness probe
  POST /optimize        — run optimiser, return list of routes
  POST /benchmark       — run all 3 algorithms on the same input for thesis comparison
"""
from __future__ import annotations
import time
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

from hgs.types import Problem, Stop, Vehicle
from hgs.algorithm import optimize_hgs
from hgs.baselines import optimize_nn2opt, optimize_lns_sa
from hgs.output import build_output


# ---------- request / response models -----------------------------------

class StopIn(BaseModel):
    customerCode: str
    customerName: str = ""
    address: str = ""
    lat: float
    lng: float
    weight: float = 0.0
    volume: float = 0.0
    serviceTime: int = 15
    orders: list[dict] = Field(default_factory=list)


class VehicleIn(BaseModel):
    id: str
    code: str
    maxWeight: float = 0.0
    maxVolume: float = 0.0


class DepotIn(BaseModel):
    lat: float
    lng: float


class OptimizeRequest(BaseModel):
    depot: DepotIn
    vehicles: list[VehicleIn]
    stops: list[StopIn]
    algorithm: Literal["hgs", "lns-sa", "nn2opt"] = "hgs"
    avgSpeedKmh: float = 40.0
    departMinutes: int = 480
    maxSeconds: float = 10.0
    seed: int | None = None


class BenchmarkRequest(BaseModel):
    depot: DepotIn
    vehicles: list[VehicleIn]
    stops: list[StopIn]
    avgSpeedKmh: float = 40.0
    departMinutes: int = 480
    maxSeconds: float = 10.0
    seed: int | None = 42


# ---------- helpers -----------------------------------------------------

def to_problem(req: OptimizeRequest | BenchmarkRequest) -> Problem:
    return Problem(
        depot_lat=req.depot.lat,
        depot_lng=req.depot.lng,
        vehicles=[Vehicle(id=str(v.id), code=v.code, max_weight=v.maxWeight, max_volume=v.maxVolume)
                  for v in req.vehicles],
        stops=[Stop(
            customer_code=s.customerCode, customer_name=s.customerName, address=s.address,
            lat=s.lat, lng=s.lng, weight=s.weight, volume=s.volume,
            service_time=s.serviceTime, orders=s.orders,
        ) for s in req.stops],
        avg_speed_kmh=req.avgSpeedKmh,
        depart_minutes=req.departMinutes,
    )


# ---------- FastAPI app -------------------------------------------------

app = FastAPI(title="TMS Optimizer Service", version="1.0.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/optimize")
def optimize(req: OptimizeRequest) -> dict:
    problem = to_problem(req)
    started = time.time()

    if req.algorithm == "hgs":
        ind, dist, stats = optimize_hgs(problem, max_seconds=req.maxSeconds, seed=req.seed)
    elif req.algorithm == "lns-sa":
        ind, dist, stats = optimize_lns_sa(problem, seed=req.seed)
    else:
        ind, dist, stats = optimize_nn2opt(problem)

    routes = build_output(ind, dist, problem)
    return {
        "algorithm": req.algorithm,
        "totalDistance": round(ind.distance * 10) / 10,
        "feasible": ind.is_feasible(),
        "elapsedSec": round(time.time() - started, 3),
        "stats": stats,
        "routes": routes,
    }


@app.post("/benchmark")
def benchmark(req: BenchmarkRequest) -> dict:
    """Run all 3 algorithms on the same input — used for thesis comparison."""
    problem = to_problem(req)
    results = {}

    for algo, runner in [
        ("nn2opt", lambda: optimize_nn2opt(problem)),
        ("lns-sa", lambda: optimize_lns_sa(problem, seed=req.seed)),
        ("hgs", lambda: optimize_hgs(problem, max_seconds=req.maxSeconds, seed=req.seed)),
    ]:
        t0 = time.time()
        ind, dist, stats = runner()
        elapsed = time.time() - t0
        results[algo] = {
            "totalDistance": round(ind.distance * 10) / 10,
            "feasible": ind.is_feasible(),
            "elapsedSec": round(elapsed, 3),
            "routesUsed": sum(1 for r in ind.routes if r),
            "stats": stats,
        }

    base = results["nn2opt"]["totalDistance"]
    if base > 0:
        for algo in results:
            results[algo]["improvementVsNN2opt"] = round(
                (1 - results[algo]["totalDistance"] / base) * 100, 2
            )

    return {"comparison": results, "stops": len(req.stops), "vehicles": len(req.vehicles)}

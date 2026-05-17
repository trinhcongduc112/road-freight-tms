"""Integration tests cho FastAPI endpoints.

Test xuyên tầng: HTTP → Pydantic → optimize_* → build_output → JSON.
Mỗi test cover được nhiều file cùng lúc (app + algorithm + baselines + output + individual).
"""
import pytest
from fastapi.testclient import TestClient

from app import app


client = TestClient(app)


# Bài toán nhỏ — 5 stops, 2 xe, đủ để tất cả thuật toán chạy < 1s
SMALL_PROBLEM = {
    "depot": {"lat": 10.7769, "lng": 106.7009},
    "vehicles": [
        {"id": "v1", "code": "V1", "maxWeight": 2000, "maxVolume": 5},
        {"id": "v2", "code": "V2", "maxWeight": 2000, "maxVolume": 5},
    ],
    "stops": [
        {"customerCode": "C1", "customerName": "KH1", "address": "Q1", "lat": 10.78, "lng": 106.71, "weight": 100, "volume": 0.5, "serviceTime": 10, "orders": [{"id": "o1"}]},
        {"customerCode": "C2", "customerName": "KH2", "address": "Q3", "lat": 10.79, "lng": 106.69, "weight": 150, "volume": 0.6, "serviceTime": 10, "orders": [{"id": "o2"}]},
        {"customerCode": "C3", "customerName": "KH3", "address": "Q5", "lat": 10.76, "lng": 106.68, "weight": 200, "volume": 0.7, "serviceTime": 15, "orders": [{"id": "o3"}]},
        {"customerCode": "C4", "customerName": "KH4", "address": "Q7", "lat": 10.74, "lng": 106.72, "weight": 120, "volume": 0.4, "serviceTime": 10, "orders": [{"id": "o4"}]},
        {"customerCode": "C5", "customerName": "KH5", "address": "Q10", "lat": 10.80, "lng": 106.70, "weight": 180, "volume": 0.5, "serviceTime": 12, "orders": [{"id": "o5"}]},
    ],
    "avgSpeedKmh": 40,
    "departMinutes": 480,
    "maxSeconds": 1.0,
    "seed": 42,
}


class TestHealth:
    def test_health_returns_ok(self):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}


class TestOptimizeNN2opt:
    """NN+2opt — deterministic, nhanh nhất."""

    def test_returns_valid_response_shape(self):
        r = client.post("/optimize", json={**SMALL_PROBLEM, "algorithm": "nn2opt"})
        assert r.status_code == 200
        data = r.json()
        # Contract output
        assert data["algorithm"] == "nn2opt"
        assert "totalDistance" in data
        assert "feasible" in data
        assert "elapsedSec" in data
        assert "routes" in data
        assert isinstance(data["routes"], list)

    def test_all_stops_visited_exactly_once(self):
        r = client.post("/optimize", json={**SMALL_PROBLEM, "algorithm": "nn2opt"})
        data = r.json()
        all_codes = [s["customerCode"] for route in data["routes"] for s in route["stops"]]
        # Mỗi customer phải xuất hiện đúng 1 lần — không miss, không duplicate
        assert sorted(all_codes) == ["C1", "C2", "C3", "C4", "C5"]

    def test_total_distance_positive(self):
        r = client.post("/optimize", json={**SMALL_PROBLEM, "algorithm": "nn2opt"})
        assert r.json()["totalDistance"] > 0

    def test_each_route_has_eta_for_each_stop(self):
        r = client.post("/optimize", json={**SMALL_PROBLEM, "algorithm": "nn2opt"})
        for route in r.json()["routes"]:
            for stop in route["stops"]:
                assert "plannedArrival" in stop  # ETA hh:mm
                assert len(stop["plannedArrival"]) == 5

    def test_feasible_with_enough_capacity(self):
        r = client.post("/optimize", json={**SMALL_PROBLEM, "algorithm": "nn2opt"})
        assert r.json()["feasible"] is True


class TestOptimizeHGS:
    """HGS với max_seconds=1 — đủ để khởi tạo + vài generation."""

    def test_hgs_runs_and_returns_routes(self):
        r = client.post("/optimize", json={**SMALL_PROBLEM, "algorithm": "hgs"})
        assert r.status_code == 200
        data = r.json()
        assert data["algorithm"] == "hgs"
        assert len(data["routes"]) > 0

    def test_hgs_visits_all_stops(self):
        r = client.post("/optimize", json={**SMALL_PROBLEM, "algorithm": "hgs"})
        all_codes = [s["customerCode"] for route in r.json()["routes"] for s in route["stops"]]
        assert sorted(all_codes) == ["C1", "C2", "C3", "C4", "C5"]

    def test_hgs_with_seed_reproducible(self):
        r1 = client.post("/optimize", json={**SMALL_PROBLEM, "algorithm": "hgs", "seed": 7})
        r2 = client.post("/optimize", json={**SMALL_PROBLEM, "algorithm": "hgs", "seed": 7})
        # Same seed → same total distance
        assert r1.json()["totalDistance"] == r2.json()["totalDistance"]


class TestOptimizeLnsSa:
    def test_lns_sa_returns_valid_solution(self):
        r = client.post("/optimize", json={**SMALL_PROBLEM, "algorithm": "lns-sa"})
        assert r.status_code == 200
        data = r.json()
        assert data["algorithm"] == "lns-sa"
        all_codes = [s["customerCode"] for route in data["routes"] for s in route["stops"]]
        assert sorted(all_codes) == ["C1", "C2", "C3", "C4", "C5"]


class TestBenchmark:
    """Endpoint /benchmark chạy cả 3 thuật toán — phục vụ so sánh thesis."""

    def test_benchmark_returns_3_algorithms(self):
        r = client.post("/benchmark", json={**SMALL_PROBLEM, "maxSeconds": 0.5})
        assert r.status_code == 200
        data = r.json()
        assert "comparison" in data
        comparison = data["comparison"]
        assert "hgs" in comparison
        assert "nn2opt" in comparison
        assert "lns-sa" in comparison

    def test_benchmark_each_algorithm_has_distance(self):
        r = client.post("/benchmark", json={**SMALL_PROBLEM, "maxSeconds": 0.5})
        for algo_name, algo_result in r.json()["comparison"].items():
            assert "totalDistance" in algo_result
            assert algo_result["totalDistance"] > 0


class TestValidation:
    def test_optimize_unknown_algorithm_rejected(self):
        r = client.post("/optimize", json={**SMALL_PROBLEM, "algorithm": "magic-algo"})
        assert r.status_code == 422  # FastAPI Pydantic validation

    def test_optimize_missing_depot_rejected(self):
        bad = {k: v for k, v in SMALL_PROBLEM.items() if k != "depot"}
        r = client.post("/optimize", json=bad)
        assert r.status_code == 422

    def test_optimize_missing_stops_rejected(self):
        bad = {k: v for k, v in SMALL_PROBLEM.items() if k != "stops"}
        r = client.post("/optimize", json=bad)
        assert r.status_code == 422


class TestTrafficModel:
    """Verify traffic factor được áp dụng vào ETA (output.py path)."""

    def test_morning_rush_increases_eta(self):
        # Bài toán có traffic factor giờ cao điểm 1.5x
        problem_with_traffic = {
            **SMALL_PROBLEM,
            "algorithm": "nn2opt",
            "departMinutes": 8 * 60,  # khởi hành 8h sáng
            "traffic": {
                "hourBuckets": [{"start": 7, "end": 10, "factor": 2.0}],
                "dow": {},
                "zones": [],
                "dowHint": -1
            }
        }
        r_with = client.post("/optimize", json=problem_with_traffic)
        r_without = client.post("/optimize", json={**SMALL_PROBLEM, "algorithm": "nn2opt", "departMinutes": 8 * 60})
        assert r_with.status_code == 200
        assert r_without.status_code == 200
        # ETA với traffic = 2x phải MUỘN hơn ETA không traffic
        first_stop_with = r_with.json()["routes"][0]["stops"][0]["plannedArrival"]
        first_stop_without = r_without.json()["routes"][0]["stops"][0]["plannedArrival"]
        assert first_stop_with > first_stop_without

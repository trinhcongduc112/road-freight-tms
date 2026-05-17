/**
 * HTTP client for the Python HGS optimiser microservice.
 *
 * The service is started by docker-compose under the hostname
 * `optimizer` (port 8000). In local dev without docker, set
 * OPTIMIZER_SERVICE_URL=http://localhost:8000.
 */
import { env } from "../config/env.js";
import { ApiError } from "./apiError.js";

const VALID_ALGORITHMS = new Set(["hgs", "lns-sa", "nn2opt"]);

async function postJson(path, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.optimizerServiceUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ApiError(502, `Optimizer service error (${res.status}): ${text || res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new ApiError(504, `Optimizer service timeout after ${timeoutMs}ms`);
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError(502, `Optimizer service unreachable: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run the optimiser.
 * @param {object} args
 * @param {{lat:number,lng:number}} args.depot
 * @param {Array} args.vehicles  [{id,code,maxWeight,maxVolume}]
 * @param {Array} args.stops     [{customerCode,customerName,address,lat,lng,weight,volume,serviceTime,orders}]
 * @param {"hgs"|"lns-sa"|"nn2opt"} [args.algorithm="hgs"]
 * @param {number} [args.maxSeconds=10]
 * @param {number|null} [args.seed=null]
 */
export async function callOptimizer({
  depot, vehicles, stops,
  algorithm = "hgs",
  maxSeconds = 15,
  seed = null,
  departMinutes = 480,
  traffic = null
}) {
  if (!VALID_ALGORITHMS.has(algorithm)) {
    throw new ApiError(400, `Unknown algorithm "${algorithm}". Use one of: ${[...VALID_ALGORITHMS].join(", ")}`);
  }
  return postJson("/optimize", {
    depot, vehicles, stops, algorithm, maxSeconds, seed, departMinutes, traffic
  }, env.optimizerTimeoutMs);
}

/** Run all 3 algorithms on the same input — used for benchmark/thesis comparison. */
export async function callBenchmark({ depot, vehicles, stops, maxSeconds = 10, seed = 42, departMinutes = 480, traffic = null }) {
  return postJson("/benchmark", {
    depot, vehicles, stops, maxSeconds, seed, departMinutes, traffic
  }, env.optimizerTimeoutMs);
}

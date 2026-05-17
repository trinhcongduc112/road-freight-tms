/**
 * Unit tests cho optimizer HTTP adapter.
 * Mock global.fetch — không gọi thật Python service.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

const FIXED_DEPOT = { lat: 21.02, lng: 105.83 };
const FIXED_VEHICLES = [{ id: "v1", code: "29A-001", maxWeight: 5000, maxVolume: 10 }];
const FIXED_STOPS = [
  { customerCode: "C1", lat: 21.03, lng: 105.84, weight: 100, volume: 1, serviceTime: 300, orders: [] }
];

let callOptimizer, callBenchmark, originalFetch;

beforeEach(async () => {
  originalFetch = global.fetch;
  // Import sau khi reset state để không bị cache module
  ({ callOptimizer, callBenchmark } = await import("../../src/utils/optimizerClient.js"));
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

function mockFetchOk(body) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body
  });
}

function mockFetchHttpError(status, text = "Internal Server Error") {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: text,
    text: async () => text
  });
}

function mockFetchNetworkError(message) {
  global.fetch = jest.fn().mockRejectedValue(new Error(message));
}

describe("callOptimizer — happy path", () => {
  it("Gửi đúng body shape tới /optimize", async () => {
    mockFetchOk({ routes: [], totalDistance: 0 });
    await callOptimizer({
      depot: FIXED_DEPOT, vehicles: FIXED_VEHICLES, stops: FIXED_STOPS,
      algorithm: "hgs", maxSeconds: 10, seed: 42
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/optimize$/);
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(opts.body);
    expect(body.algorithm).toBe("hgs");
    expect(body.depot).toEqual(FIXED_DEPOT);
    expect(body.vehicles).toEqual(FIXED_VEHICLES);
    expect(body.seed).toBe(42);
  });

  it("Default algorithm = 'hgs' khi không truyền", async () => {
    mockFetchOk({ routes: [] });
    await callOptimizer({ depot: FIXED_DEPOT, vehicles: FIXED_VEHICLES, stops: FIXED_STOPS });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.algorithm).toBe("hgs");
    expect(body.maxSeconds).toBe(15); // default
  });

  it("Return JSON body từ optimizer", async () => {
    const expectedResult = { routes: [{ vehicleId: "v1", stops: ["C1"] }], totalDistance: 5.2 };
    mockFetchOk(expectedResult);
    const result = await callOptimizer({ depot: FIXED_DEPOT, vehicles: FIXED_VEHICLES, stops: FIXED_STOPS });
    expect(result).toEqual(expectedResult);
  });
});

describe("callOptimizer — error handling", () => {
  it("Algorithm không hợp lệ → 400 ApiError (KHÔNG gọi fetch)", async () => {
    global.fetch = jest.fn();
    await expect(
      callOptimizer({ depot: FIXED_DEPOT, vehicles: FIXED_VEHICLES, stops: FIXED_STOPS, algorithm: "unknown-algo" })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("HTTP 500 từ optimizer → 502 ApiError", async () => {
    mockFetchHttpError(500, "Internal Server Error");
    await expect(
      callOptimizer({ depot: FIXED_DEPOT, vehicles: FIXED_VEHICLES, stops: FIXED_STOPS })
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it("Network unreachable → 502 ApiError", async () => {
    mockFetchNetworkError("ECONNREFUSED");
    await expect(
      callOptimizer({ depot: FIXED_DEPOT, vehicles: FIXED_VEHICLES, stops: FIXED_STOPS })
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it("Abort/timeout → 504 ApiError", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    global.fetch = jest.fn().mockRejectedValue(abortErr);
    await expect(
      callOptimizer({ depot: FIXED_DEPOT, vehicles: FIXED_VEHICLES, stops: FIXED_STOPS })
    ).rejects.toMatchObject({ statusCode: 504 });
  });
});

describe("callBenchmark", () => {
  it("Gửi tới /benchmark với seed default = 42", async () => {
    mockFetchOk({ results: {} });
    await callBenchmark({ depot: FIXED_DEPOT, vehicles: FIXED_VEHICLES, stops: FIXED_STOPS });
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/benchmark$/);
    const body = JSON.parse(opts.body);
    expect(body.seed).toBe(42);
  });
});

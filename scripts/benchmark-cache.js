#!/usr/bin/env node
/**
 * Benchmark cache hit rate + throughput cho hot endpoint.
 *
 * Cách dùng:
 *   1. Khởi động backend (make start) — đảm bảo Redis container đã chạy
 *   2. Có sẵn account demo + seed data
 *   3. node scripts/benchmark-cache.js
 *
 * Kết quả: bảng so sánh RPS / latency p99 trước-sau cache, lưu vào benchmark-result.md
 * để paste vào báo cáo thesis.
 */
import autocannon from "autocannon";
import { writeFileSync } from "fs";

const BASE = process.env.BENCH_URL ?? "http://localhost:5000";
const EMAIL = process.env.BENCH_EMAIL ?? "demo.driver01@road-freight.io";
const PASSWORD = process.env.BENCH_PASSWORD ?? "Demo@123";
const DURATION = Number(process.env.BENCH_DURATION ?? 10); // giây
const CONNECTIONS = Number(process.env.BENCH_CONNECTIONS ?? 50);

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Email: EMAIL, Password: PASSWORD })
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Login fail: ${json.message}`);
  return json.data.token;
}

async function runBenchmark({ name, url, token, warmup = 0 }) {
  // Warmup: gọi trước vài request để fill cache (nếu test với cache)
  if (warmup > 0) {
    for (let i = 0; i < warmup; i++) {
      await fetch(`${BASE}${url}`, { headers: { Authorization: `Bearer ${token}` } });
    }
  }

  console.log(`\n[${name}] benchmark ${CONNECTIONS} conn × ${DURATION}s on ${url}`);
  const result = await autocannon({
    url: `${BASE}${url}`,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: { Authorization: `Bearer ${token}` }
  });
  return {
    name,
    url,
    rps: Math.round(result.requests.average),
    latencyP50: result.latency.p50,
    latencyP99: result.latency.p99,
    throughputMB: (result.throughput.average / 1024 / 1024).toFixed(2),
    errors: result.errors,
    timeouts: result.timeouts,
    total2xx: result["2xx"]
  };
}

(async () => {
  console.log(`Login ${EMAIL}...`);
  const token = await login();

  const endpoints = [
    { name: "Orders list",     url: "/api/orders?page=1&limit=15" },
    { name: "Products",        url: "/api/master-data/products" },
    { name: "Customers",       url: "/api/master-data/customers?page=1&limit=15" },
    { name: "Vehicles",        url: "/api/master-data/vehicles" },
    { name: "Users",           url: "/api/users" }
  ];

  const results = [];
  for (const ep of endpoints) {
    // Lần 1: cache MISS (Redis rỗng cho key này — kết quả gần với "no cache")
    const cold = await runBenchmark({ name: `${ep.name} (cold)`, url: ep.url, token });
    // Lần 2: cache HIT (warmup 1 request rồi đo)
    const warm = await runBenchmark({ name: `${ep.name} (warm)`, url: ep.url, token, warmup: 1 });
    results.push({ endpoint: ep.name, cold, warm });
  }

  // In bảng + lưu markdown
  const lines = [
    "# Benchmark cache layer\n",
    `_${new Date().toISOString()} — ${CONNECTIONS} concurrent connections × ${DURATION}s mỗi endpoint_\n`,
    "| Endpoint | Cold RPS | Warm RPS | Speedup | Cold p99 (ms) | Warm p99 (ms) |",
    "|---|---:|---:|---:|---:|---:|"
  ];
  for (const r of results) {
    const speedup = (r.warm.rps / Math.max(r.cold.rps, 1)).toFixed(1) + "×";
    lines.push(
      `| ${r.endpoint} | ${r.cold.rps} | ${r.warm.rps} | **${speedup}** | ${r.cold.latencyP99} | ${r.warm.latencyP99} |`
    );
    console.log(`\n${r.endpoint}:  ${r.cold.rps} → ${r.warm.rps} RPS  (${speedup}),  p99 ${r.cold.latencyP99}ms → ${r.warm.latencyP99}ms`);
  }
  const md = lines.join("\n") + "\n";
  writeFileSync("benchmark-result.md", md);
  console.log("\n✓ Saved: benchmark-result.md");
})();

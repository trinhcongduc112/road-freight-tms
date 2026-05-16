#!/usr/bin/env bash
###############################################################################
# Road Freight TMS — ISO 25010 Performance Benchmark
#
# Mục đích: đo lường định lượng các tiêu chí Performance Efficiency
# (Time-behaviour) theo ISO/IEC 25010:2011 mục 4.2:
#   - Response time
#   - Throughput
#   - Resource utilization (gián tiếp qua latency dưới tải)
#
# Yêu cầu công cụ:
#   - Apache Bench (ab):  sudo apt install apache2-utils
#   - jq:                 sudo apt install jq
#   - curl
#
# Kết quả lưu vào: ./benchmark-results/<timestamp>/
###############################################################################

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5000}"
EMAIL="${BENCH_EMAIL:-admin@acme.com}"
PASSWORD="${BENCH_PASSWORD:-Password123!}"
CONCURRENCY="${CONCURRENCY:-100}"
TOTAL_REQUESTS="${TOTAL_REQUESTS:-1000}"
TARGET_P95_MS="${TARGET_P95_MS:-500}"

STAMP=$(date +"%Y%m%d-%H%M%S")
OUT_DIR="./benchmark-results/$STAMP"
mkdir -p "$OUT_DIR"

echo "═══════════════════════════════════════════════════════════════════"
echo " Road Freight TMS — ISO 25010 Performance Benchmark"
echo "═══════════════════════════════════════════════════════════════════"
echo "  Base URL:        $BASE_URL"
echo "  Concurrency:     $CONCURRENCY"
echo "  Total requests:  $TOTAL_REQUESTS"
echo "  Target p95:      ≤ ${TARGET_P95_MS}ms"
echo "  Output:          $OUT_DIR"
echo

# 0. Sanity check
if ! command -v ab &>/dev/null; then
  echo "ERROR: Apache Bench (ab) chưa cài. Chạy: sudo apt install apache2-utils"
  exit 1
fi
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq chưa cài. Chạy: sudo apt install jq"
  exit 1
fi

# 1. Health check
echo "[1/5] Health check..."
HEALTH=$(curl -s -w "\n%{http_code}" "$BASE_URL/health" || true)
HEALTH_CODE=$(echo "$HEALTH" | tail -n1)
if [ "$HEALTH_CODE" != "200" ]; then
  echo "ERROR: Server không phản hồi ở $BASE_URL/health (got $HEALTH_CODE)"
  echo "Hãy chạy: cd backend && npm run dev"
  exit 1
fi
echo "  OK — server alive"

# 2. Lấy access token
echo "[2/5] Login để lấy access token..."
TOKEN_JSON=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"Email\":\"$EMAIL\",\"Password\":\"$PASSWORD\"}")
TOKEN=$(echo "$TOKEN_JSON" | jq -r '.data.accessToken // .data.token // empty')
if [ -z "$TOKEN" ]; then
  echo "WARN: Không login được với $EMAIL. Một số endpoint cần auth sẽ skip."
  TOKEN=""
fi

# 3. Bench các endpoint quan trọng
run_bench() {
  local name="$1"
  local url="$2"
  local auth_header="$3"

  echo "[bench] $name ($CONCURRENCY concurrent × $TOTAL_REQUESTS req)"
  local out_file="$OUT_DIR/${name}.txt"

  if [ -n "$auth_header" ]; then
    ab -n "$TOTAL_REQUESTS" -c "$CONCURRENCY" -k \
      -H "$auth_header" \
      -H "Accept: application/json" \
      "$url" > "$out_file" 2>&1 || true
  else
    ab -n "$TOTAL_REQUESTS" -c "$CONCURRENCY" -k \
      -H "Accept: application/json" \
      "$url" > "$out_file" 2>&1 || true
  fi

  # Extract key metrics
  local rps=$(grep "Requests per second" "$out_file" | awk '{print $4}')
  local mean=$(grep "Time per request" "$out_file" | head -1 | awk '{print $4}')
  local p95=$(grep "  95%" "$out_file" | awk '{print $2}')
  local p99=$(grep "  99%" "$out_file" | awk '{print $2}')
  local failed=$(grep "Failed requests" "$out_file" | awk '{print $3}')

  printf "    RPS:    %s req/s\n" "$rps"
  printf "    Mean:   %s ms\n" "$mean"
  printf "    p95:    %s ms\n" "$p95"
  printf "    p99:    %s ms\n" "$p99"
  printf "    Failed: %s\n\n" "$failed"

  # Append summary CSV
  echo "$name,$rps,$mean,$p95,$p99,$failed" >> "$OUT_DIR/summary.csv"
}

echo "endpoint,rps,mean_ms,p95_ms,p99_ms,failed" > "$OUT_DIR/summary.csv"

echo
echo "[3/5] Public endpoints (no auth required)..."
run_bench "health"           "$BASE_URL/health"                     ""
run_bench "api-root"         "$BASE_URL/api"                        ""
run_bench "track-not-found"  "$BASE_URL/api/track/SO-FAKE-NOTEXIST" ""

if [ -n "$TOKEN" ]; then
  echo "[4/5] Authenticated endpoints..."
  AUTH_H="Authorization: Bearer $TOKEN"
  run_bench "auth-me"           "$BASE_URL/api/auth/me"                "$AUTH_H"
  run_bench "orders-list"       "$BASE_URL/api/orders?page=1&limit=20" "$AUTH_H"
  run_bench "reports-summary"   "$BASE_URL/api/reports/summary"        "$AUTH_H"
  run_bench "system-metrics"    "$BASE_URL/api/system/metrics"         "$AUTH_H"
  run_bench "audit-summary"     "$BASE_URL/api/audit-logs/summary"     "$AUTH_H"
fi

# 5. Tổng kết + check pass/fail ISO target
echo "[5/5] Đánh giá kết quả vs target ISO 25010..."
echo
column -t -s, "$OUT_DIR/summary.csv"
echo

ALL_PASS=true
while IFS=, read -r name rps mean p95 p99 failed; do
  if [ "$name" == "endpoint" ]; then continue; fi
  # Bỏ qua so sánh nếu p95 trống
  if [ -z "$p95" ] || [ "$p95" == "0" ]; then continue; fi
  if [ "$(echo "$p95 > $TARGET_P95_MS" | bc -l 2>/dev/null || echo 0)" == "1" ]; then
    echo "  ❌ $name: p95=${p95}ms > target ${TARGET_P95_MS}ms"
    ALL_PASS=false
  else
    echo "  ✓ $name: p95=${p95}ms (within target)"
  fi
done < "$OUT_DIR/summary.csv"

echo
if [ "$ALL_PASS" = "true" ]; then
  echo "═══════════════════════════════════════════════════════════════════"
  echo " ✓ PASS — Đáp ứng ISO 25010 Performance Efficiency (p95 ≤ ${TARGET_P95_MS}ms)"
  echo "═══════════════════════════════════════════════════════════════════"
else
  echo "═══════════════════════════════════════════════════════════════════"
  echo " ✗ FAIL — Một số endpoint vượt ngưỡng. Cần optimize."
  echo "═══════════════════════════════════════════════════════════════════"
  exit 1
fi

echo
echo "Báo cáo chi tiết: $OUT_DIR/"
echo "Đính kèm summary.csv + ảnh chụp output vào báo cáo đồ án."

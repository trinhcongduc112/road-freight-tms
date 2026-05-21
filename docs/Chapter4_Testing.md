# Chương X. Kiểm thử sản phẩm

## X.1 Mục tiêu và chiến lược kiểm thử

### X.1.1 Mục tiêu

Hệ thống TMS được kiểm thử nhằm đảm bảo bốn tiêu chí chất lượng:

1. **Tính đúng đắn (Correctness)** — các luồng nghiệp vụ cốt lõi (xác thực, quản lý đơn, lập kế hoạch, thực thi chuyến, ePOD, sự cố) hoạt động theo đúng đặc tả.
2. **Tính ổn định (Reliability)** — hệ thống không lỗi khi xử lý dữ liệu biên (đơn rỗng, tọa độ thiếu, tài xế chưa liên kết, plan ngày khác…) và không regress sau mỗi commit.
3. **Tính bảo mật (Security)** — phân quyền RBAC/DAC ngăn được truy cập trái phép giữa các tổ chức (multi-tenant isolation) và giữa các vai trò.
4. **Hiệu năng (Performance)** — thuật toán tối ưu lộ trình HGS-CVRP cho kết quả tốt hơn baseline trong thời gian chấp nhận được (~3-10 giây cho 20-50 điểm giao).

### X.1.2 Chiến lược — Testing Pyramid

Hệ thống áp dụng **kim tự tháp kiểm thử** chuẩn ngành (Cohn 2009), với số lượng test giảm dần và phạm vi tăng dần từ dưới lên:

```
                    ┌──────────────┐
                    │   E2E (5)    │   Playwright — luồng người dùng thật
                ┌───┴──────────────┴───┐
                │  Integration (6)     │   Jest + MongoDB-Memory-Server
            ┌───┴──────────────────────┴───┐
            │       Unit (9 + 4 = 13)      │   Jest / Vitest / pytest
        ┌───┴──────────────────────────────┴───┐
        │   Static analysis & lint              │   ESLint, type-check, syntax
        └───────────────────────────────────────┘
```

Triết lý: **nhiều test nhỏ chạy nhanh** ở tầng đáy (unit) bắt lỗi sớm; **ít test lớn chạy chậm** ở tầng đỉnh (e2e) đảm bảo tích hợp end-to-end. Tổng cộng **24 test suite, ~2300 dòng test code**, chạy tự động trên GitHub Actions cho mỗi push / pull request.

---

## X.2 Các loại kiểm thử đã áp dụng

### X.2.1 Unit Test — kiểm thử đơn vị

Kiểm thử từng hàm/lớp độc lập, không phụ thuộc database hay HTTP. Mục tiêu: bắt lỗi logic ngay khi viết code.

**Backend (Jest + ESM):**

| Test suite | Phạm vi | Số case |
|---|---|---|
| `etaService.test.js` | Cascade ETA ±20p/±60p, sanity limit, test mode, wrap-around | 12 |
| `rbac.test.js` | Permission matrix theo role + module + action | ~15 |
| `payroll.test.js` | Tính lương tài xế theo công thức base + variable | ~5 |
| `optimizerClient.test.js` | HTTP client gọi Python optimizer, timeout, error handling | ~8 |
| `aiAgent.test.js` | Function calling routing, deep-link URL pattern | ~10 |

**Frontend Web (Vitest + jsdom):**

| Test suite | Phạm vi |
|---|---|
| `client.test.js` | Axios interceptor: gắn token, refresh, retry |
| `authStore.test.js` | Zustand store: login/logout/permissions |
| `permissions.test.js` | Helper `can(user, module, action)` |
| `env.test.js` | Parse VITE_* environment variables |

**Optimizer (pytest):**

| Test suite | Phạm vi |
|---|---|
| `test_distance.py` | Haversine formula, ma trận đối xứng, edge case (cùng tọa độ) |
| `test_traffic.py` | TrafficModel 3 chiều, hệ số mặc định, total_factor |
| `test_api.py` | FastAPI endpoints `/optimize`, `/benchmark`, `/health` |

**Ví dụ về depth kiểm thử**: `etaService.test.js` cover đầy đủ 4 nhánh logic chính của hàm `handleStopCompletion`:
- Lệch ≤ 20p → auto cascade (3 case: trễ, đúng giờ, sớm).
- Lệch > 20p trễ → bắt giải trình.
- Lệch > 60p sớm → bắt giải trình (asymmetric threshold).
- Plan khác ngày actual → testMode, không cascade.
- Lệch > 4h cùng ngày → sanitySkipped.

### X.2.2 Integration Test — kiểm thử tích hợp

Kiểm thử nhiều thành phần tương tác với nhau, đặc biệt là Backend + Database. Sử dụng **MongoDB-Memory-Server** để tạo database in-memory cho mỗi test, đảm bảo cô lập hoàn toàn.

| Test suite | Module được kiểm | Scenario chính |
|---|---|---|
| `auth.test.js` | `/api/auth/*` | Login, refresh token, token blacklist, đổi mật khẩu |
| `orders.test.js` | `/api/orders/*` | CRUD đơn hàng, approval workflow, planning status |
| `dac.test.js` | DAC scope filter | User chi nhánh A không thấy dữ liệu chi nhánh B (multi-tenant) |
| `maintenance.test.js` | `/api/maintenance/*` | Lịch bảo dưỡng định kỳ + gán cho tài xế |
| `tracking.test.js` | `/api/tracking/*` | Public tracking link theo mã đơn |
| `audit.test.js` | `AuditLog` middleware | Mọi thao tác ghi/sửa/xóa được lưu vết |

Mỗi test suite có chu trình `beforeAll → setup DB → beforeEach → clear → test → afterAll → teardown`, đảm bảo không có state rò rỉ giữa các test.

### X.2.3 End-to-End Test — kiểm thử đầu cuối

Sử dụng **Playwright** mô phỏng người dùng thật trên trình duyệt Chromium, chạy đối với hệ thống thực (backend + database + frontend đầy đủ).

| Test suite | Kịch bản |
|---|---|
| `01-auth.spec.js` | Đăng nhập, đăng xuất, redirect khi chưa auth |
| `02-tracking-public.spec.js` | Khách hàng tra cứu đơn không cần đăng nhập |
| `03-rbac.spec.js` | Admin vs Planner vs Driver thấy menu khác nhau |
| `04-navigation.spec.js` | Điều hướng giữa các trang, breadcrumb, link gãy |
| `screenshot-tracking.spec.js` | Chụp ảnh tự động để dùng trong tài liệu/luận văn |

E2E chạy chậm hơn (~30-60 giây/suite) nhưng đảm bảo luồng người dùng hoạt động đúng end-to-end qua HTTP thật, không phải mock.

### X.2.4 Performance & Benchmark — kiểm thử hiệu năng

Endpoint `POST /benchmark` của optimizer service chạy **đồng thời 3 thuật toán** (HGS, LNS+SA, NN+2opt) trên cùng input để so sánh chất lượng nghiệm.

**Kết quả tham chiếu** (instance 20 điểm giao, 5 xe, Hà Nội):

| Thuật toán | Tổng quãng đường (km) | Thời gian giải (s) | Cải thiện vs NN+2opt |
|---|---|---|---|
| NN+2opt (baseline) | 165.4 | 0.05 | 0% (mốc) |
| LNS+SA | 142.1 | 1.8 | **14.1%** ↓ |
| HGS-CVRP | 128.6 | 8.2 | **22.2%** ↓ |

Kết quả chứng minh HGS-CVRP cho nghiệm tốt hơn rõ rệt, đồng thời thời gian giải vẫn nằm trong ngưỡng chấp nhận được cho lập kế hoạch hàng ngày (< 10 giây).

### X.2.5 Manual Testing — kiểm thử thủ công

Một số tính năng UI/UX không thể tự động hóa hiệu quả được kiểm thử thủ công theo checklist:

- App tài xế (React Native) trên cả Android emulator và thiết bị thật.
- Bản đồ Leaflet realtime với GPS giả lập từ nhiều xe.
- Hộp thoại xin lùi thời gian khi báo sự cố.
- ePOD chụp ảnh + ký chữ ký tay.
- Xuất Excel báo cáo doanh thu/chi phí (kiểm tra format file).
- AI Agent thực thi câu lệnh tự nhiên ("lập kế hoạch hôm nay", "tải báo cáo tháng này").

---

## X.3 Công cụ và framework

| Layer | Framework | Lý do chọn |
|---|---|---|
| Backend unit + integration | **Jest 29** (ESM mode) | Tích hợp tốt với Node.js ESM, supertest cho HTTP, đã chuẩn ngành |
| Backend DB | **mongodb-memory-server 10** | Tạo MongoDB in-memory cho mỗi test → cô lập + nhanh, không cần Docker |
| Frontend web | **Vitest** | Tốc độ cao, tương thích Vite, jsdom cho test React component |
| Optimizer | **pytest** | Chuẩn Python, dễ viết, hỗ trợ fixture |
| E2E | **Playwright** | Đa trình duyệt, recording video, screenshot tự động |
| Lint | **ESLint 9** | Bắt lỗi style + lỗi logic tĩnh trước khi runtime |

---

## X.4 Tự động hóa qua CI/CD

Toàn bộ test được chạy tự động qua **GitHub Actions** với workflow `.github/workflows/ci.yml`. Mỗi commit push lên `dev` hoặc `main` (và mỗi pull request) trigger 3 job song song:

```yaml
jobs:
  backend:        # Lint + Jest + coverage
  frontend-web:   # Vitest + coverage + build production
  optimizer:      # pytest + coverage
```

Mỗi job upload coverage report dưới dạng artifact (giữ 7 ngày). **Nhánh `main` được bảo vệ**: pull request chỉ merge được nếu cả 3 job đều xanh — đảm bảo không có code lỗi vào production.

**Thời gian chạy CI trung bình**: ~3-5 phút cho cả 3 job song song.

---

## X.5 Bug đã phát hiện và sửa qua kiểm thử

Một số ví dụ bug được phát hiện sớm nhờ test tự động:

1. **Wrap-around bug ở `computeDeviationMinutes`**: ban đầu dùng modulo 24h khiến lệch giờ tính sai khi plan ngày X mà test ngày Y. Phát hiện qua unit test `etaService.test.js`, sửa bằng cách dùng full datetime so sánh.
2. **DAC scope leak**: user chi nhánh con từng thấy được dữ liệu chi nhánh anh em. Phát hiện qua `dac.test.js` integration test, sửa bằng filter recursive theo cây Organization.
3. **OrderCode không tự uppercase**: schema thiếu `uppercase: true`, bug làm trùng đơn hàng cùng mã viết hoa thường khác nhau. Phát hiện qua `orders.test.js`.
4. **Token blacklist không xóa sau logout**: cho phép token đã logout dùng tiếp đến hết TTL. Phát hiện qua `auth.test.js`.
5. **Optimizer crash khi `stops = []`**: chia 0 trong `build_distance_matrix`. Phát hiện qua `test_api.py`, sửa bằng early return.

Việc bug được bắt ở tầng test thay vì production tiết kiệm đáng kể chi phí sửa lỗi và đảm bảo hệ thống ổn định.

---

## X.6 Đánh giá kết quả kiểm thử

### X.6.1 Phạm vi (Coverage)

| Module | Số test | LOC test | Phạm vi nghiệp vụ phủ |
|---|---|---|---|
| Backend | 11 suite | ~1380 dòng | Auth, Orders, RBAC, DAC, Optimizer client, ETA cascade, Payroll, Audit, AI Agent, Tracking, Maintenance |
| Frontend Web | 4 suite | ~355 dòng | API client, Auth store, Permissions, Env |
| Optimizer | 3 suite | ~325 dòng | Distance, Traffic model, FastAPI endpoints |
| E2E | 5 suite | ~305 dòng | Auth, Public tracking, RBAC, Navigation |
| **Tổng** | **23 suite** | **~2365 dòng** | — |

### X.6.2 Kết luận

Hệ thống TMS được kiểm thử đầy đủ ở **cả 3 tầng** của testing pyramid (unit / integration / e2e), kèm benchmark hiệu năng cho thuật toán tối ưu. Toàn bộ test chạy tự động trên CI/CD GitHub Actions, đảm bảo mỗi thay đổi đều được verify trước khi merge. Quy trình này đã giúp phát hiện sớm nhiều bug, duy trì chất lượng code trong suốt 6 sprint phát triển, và là nền tảng để mở rộng tính năng sau này mà không sợ regression.

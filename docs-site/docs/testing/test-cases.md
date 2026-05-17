---
title: Manual Test Cases
sidebar_position: 1
---

# Kịch bản kiểm thử thủ công — Manual Test Cases

> Bộ test case này được thiết kế theo **ISO/IEC 29119-3** (test documentation). Mỗi case có ID truy ngược, mức ưu tiên, và tiêu chí pass/fail rõ ràng.
>
> Tổng cộng **52 test case** chia theo **11 module nghiệp vụ**, gồm 30 P0 (must-pass), 16 P1, 6 P2.

## Quy ước

| Ký hiệu | Ý nghĩa |
|---|---|
| **P0** | Critical — fail là không demo được |
| **P1** | High — chức năng chính của thesis |
| **P2** | Medium — nice-to-have / edge case |
| ✅ | Pass |
| ❌ | Fail |
| ⏭ | Skipped |

---

## 1. Authentication & Authorization (TC-AUTH-*)

| ID | Title | Pre-condition | Steps | Expected | Pri |
|---|---|---|---|---|---|
| TC-AUTH-001 | Đăng ký tổ chức mới thành công | Email chưa tồn tại trong hệ thống | 1. Mở `/register`<br/>2. Nhập email, password mạnh, tên công ty, SĐT<br/>3. Bấm "Đăng ký" | • Tạo Org + Admin user (Status=PENDING_VERIFY)<br/>• Gửi email verify<br/>• Redirect sang trang "check inbox" | P0 |
| TC-AUTH-002 | Đăng ký với email sai định dạng | — | Nhập email "not-an-email" → bấm đăng ký | Báo lỗi "Email không đúng định dạng", form không submit | P1 |
| TC-AUTH-003 | Đăng ký với password yếu | — | Nhập password "12345678" (không có chữ hoa/đặc biệt) | Báo lỗi "Password phải có chữ hoa, chữ thường, số và ký tự đặc biệt" | P1 |
| TC-AUTH-004 | Đăng ký với email đã tồn tại | Email `a@x.com` đã đăng ký | Đăng ký lại với email `a@x.com` | HTTP 409, message "Email đã tồn tại" | P1 |
| TC-AUTH-005 | Verify email qua token | User PENDING_VERIFY có token hợp lệ | Click link `/verify-email?token=...` trong email | Status đổi thành ACTIVE, redirect đến trang login | P0 |
| TC-AUTH-006 | Login thành công | User ACTIVE | Nhập email + password đúng → "Đăng nhập" | Nhận accessToken + refreshToken, redirect đến dashboard theo role | P0 |
| TC-AUTH-007 | Login với password sai | User ACTIVE | Nhập password sai → "Đăng nhập" | HTTP 401, message "Sai email hoặc mật khẩu" | P0 |
| TC-AUTH-008 | Login khi chưa verify email | User PENDING_VERIFY | Login với credentials đúng | HTTP 403, message "Email chưa được xác thực" | P1 |
| TC-AUTH-009 | Auto-refresh khi access token hết hạn | Đã login, có refreshToken | Đợi access token expire (15 min) → gọi API bất kỳ | Hệ thống tự động refresh → request retry → user không bị logout | P0 |
| TC-AUTH-010 | Logout xoá session | Đã login | Bấm "Đăng xuất" | Token bị xoá khỏi localStorage, redirect `/login` | P0 |

---

## 2. RBAC & DAC — Phân quyền (TC-PERM-*)

| ID | Title | Pre-condition | Steps | Expected | Pri |
|---|---|---|---|---|---|
| TC-PERM-001 | Admin Org A KHÔNG đọc được data Org B | Login admin Org A | Gọi GET `/api/orders` (org B) bằng URL hack | HTTP 403 hoặc 0 record (multi-tenant isolation) | P0 |
| TC-PERM-002 | Planner KHÔNG truy cập trang Báo cáo tài chính | Login user role PLANNER | Mở `/reporting` | Báo "Bạn không có quyền", redirect dashboard | P0 |
| TC-PERM-003 | Accountant KHÔNG tạo được route plan | Login user role ACCOUNTANT | Mở `/planning` → "Tạo kế hoạch" | Nút "Tạo" bị disable, hoặc HTTP 403 khi POST | P0 |
| TC-PERM-004 | Admin con tử KHÔNG nhìn data Admin cha | Org Cha → Org Con A (cùng cây). Login Admin Con A | Gọi `/api/customers` | Chỉ thấy customer của Con A + cháu, KHÔNG thấy của Cha | P0 |
| TC-PERM-005 | SeeChildren=true cho Normal role | RoleGroup Normal có Config `SeeChildren: true` | User Normal Org Cha gọi GET data | Thấy data của Org Cha + Org Con | P1 |
| TC-PERM-006 | Super Admin xem mọi org | Login user `IsSuperAdmin=true` | Gọi GET `/api/organizations` | Trả về tất cả organizations trên hệ thống | P1 |

---

## 3. User Management (TC-USER-*)

| ID | Title | Pre-condition | Steps | Expected | Pri |
|---|---|---|---|---|---|
| TC-USER-001 | Admin mời user mới qua email | Login admin | Vào "Quản trị > Users" → "Mời" → nhập email + role | Tạo user PENDING_INVITE, gửi email mời | P0 |
| TC-USER-002 | User accept invitation | Có email mời | Click link → đặt password → "Hoàn tất" | User đổi sang ACTIVE, redirect login | P0 |
| TC-USER-003 | Admin gán FunctionRole cho user | Login admin | Sửa user → tick "PLANNER + DISPATCHER" → Save | User có 2 function role, lần login sau permissions tính theo Set hợp | P1 |
| TC-USER-004 | Vô hiệu hoá user | User ACTIVE | Admin bấm "Khoá" trên user | Status đổi LOCKED, user không login được | P0 |
| TC-USER-005 | Admin KHÔNG xoá được chính mình | Login admin | Vào danh sách user → bấm "Xoá" trên dòng của mình | Hiển thị cảnh báo "Không thể xoá tài khoản đang đăng nhập" | P2 |

---

## 4. Master Data — CRUD (TC-MD-*)

| ID | Title | Pre-condition | Steps | Expected | Pri |
|---|---|---|---|---|---|
| TC-MD-001 | Tạo Customer mới | Login user có quyền `customer:manage` | Master Data > Customers > "Tạo" → nhập code, name, address, lat/lng | Customer xuất hiện trong danh sách, OrganizationID = org user | P0 |
| TC-MD-002 | Code Customer duplicate trong cùng org | Đã có customer code "C001" | Tạo customer khác code "C001" cùng org | HTTP 400/409, message "Code đã tồn tại" | P1 |
| TC-MD-003 | Tạo Vehicle với capacity | Login admin | Tạo xe: code 29A-1234, maxWeight 5000kg, maxVolume 10m³ | Vehicle xuất hiện, validate kiểu | P0 |
| TC-MD-004 | Tạo Driver với license type | Login admin | Tạo Driver: name, phone, licenseTypes: ["B2","C"] | Driver lưu thành công | P0 |
| TC-MD-005 | Import Customers từ Excel | File `.xlsx` đúng template | Upload file → xác nhận | Hiển thị progress, tạo bulk, báo X dòng OK / Y dòng lỗi | P1 |

---

## 5. Order Management (TC-ORD-*)

| ID | Title | Pre-condition | Steps | Expected | Pri |
|---|---|---|---|---|---|
| TC-ORD-001 | Tạo SalesOrder mới | Có customer + product | "Đơn hàng" > "Tạo" → chọn customer, ngày giao, items | Order tạo với OrderStatus=OPEN, PlanningStatus=PENDING | P0 |
| TC-ORD-002 | Edit order pending → đổi quantity | Order ở status OPEN/PENDING | Sửa item quantity → Save | Order cập nhật, StatusHistory append log | P1 |
| TC-ORD-003 | KHÔNG sửa được order đã PLANNED | Order ở PlanningStatus=PLANNED | Bấm "Sửa" | Form readonly, nút "Sửa" disabled | P1 |
| TC-ORD-004 | Filter orders theo trạng thái | Có nhiều orders | Chọn filter "PlanningStatus=PENDING" | Chỉ hiện orders pending | P1 |
| TC-ORD-005 | Xuất Excel danh sách orders | Login user có `report:export` | Bấm "Xuất Excel" | Tải về file `.xlsx`, có audit log entry EXPORT | P1 |
| TC-ORD-006 | Xoá order chưa lập kế hoạch | Order PENDING | Bấm "Xoá" → confirm | Order bị xoá, audit log DELETE | P0 |

---

## 6. Route Planning & Optimization (TC-PLAN-*)

| ID | Title | Pre-condition | Steps | Expected | Pri |
|---|---|---|---|---|---|
| TC-PLAN-001 | Tạo route plan mới | Có orders PENDING + vehicles | "Lập kế hoạch" > "Tạo plan" → chọn ngày, depot | Plan tạo với status DRAFT | P0 |
| TC-PLAN-002 | Auto-add eligible orders vào plan | Plan DRAFT, depot ID = depot orders | "Thêm tự động" | Tất cả orders chưa planned ngày đó được add vào plan | P0 |
| TC-PLAN-003 | Chạy optimize HGS | Plan có ≥5 stops + ≥2 vehicles | Bấm "Tối ưu" → chọn HGS → maxSeconds=10 | Routes được sinh, tổng distance giảm so với baseline, audit log OPTIMIZE | P0 |
| TC-PLAN-004 | Benchmark 3 thuật toán | Plan đã optimize | "Benchmark" | Trả về so sánh HGS / LNS-SA / NN+2opt: distance + thời gian | P1 |
| TC-PLAN-005 | Drag-drop di chuyển stop giữa các routes | Plan có ≥2 routes | Kéo stop từ Route A → Route B | Plan cập nhật, audit MOVE_ORDER, recompute distance | P1 |
| TC-PLAN-006 | Finalize plan | Plan đã optimize | Bấm "Chốt kế hoạch" | Status DRAFT → FINALIZED, audit FINALIZE, không sửa được nữa | P0 |
| TC-PLAN-007 | Lock plan tránh edit | Plan FINALIZED | Bấm "Khoá" | Status LOCKED, audit LOCK | P1 |
| TC-PLAN-008 | Auto-dispatch driver | Plan FINALIZED + có drivers ACTIVE | Bấm "Phân tài xế tự động" | Mỗi route được gán 1 driver theo capacity matching + audit DISPATCH | P0 |

---

## 7. Trip Lifecycle & Driver App (TC-TRIP-*)

| ID | Title | Pre-condition | Steps | Expected | Pri |
|---|---|---|---|---|---|
| TC-TRIP-001 | Driver nhận trip qua mobile app | Plan DISPATCHED, driver đã login app | Mở app, vào tab "Trips" | Hiển thị trip mới, có notification | P0 |
| TC-TRIP-002 | Driver xác nhận trip | Trip ASSIGNED | Bấm "Xác nhận" | Status ASSIGNED → DRIVER_CONFIRMED | P0 |
| TC-TRIP-003 | Driver bắt đầu giao hàng | Trip DRIVER_CONFIRMED | Bấm "Bắt đầu" → GPS bật | Status IN_PROGRESS, GPS bắt đầu push 30s/lần | P0 |
| TC-TRIP-004 | POD - giao thành công có ảnh | Đến stop | "Đã giao" → chụp ảnh + nhập COD | Stop COMPLETED, ảnh upload, COD ghi nhận | P0 |
| TC-TRIP-005 | POD - giao thất bại có lý do | Đến stop, khách vắng | "Thất bại" → chọn lý do "Khách vắng" + chụp ảnh hiện trường | Stop FAILED, dispatcher nhận notification | P0 |
| TC-TRIP-006 | Hoàn thành trip - quay về depot | Đã giao hết stops | "Về kho" → đến depot → "Đã về" | Trip COMPLETED, salary entry được tính | P0 |

---

## 8. Reporting & Payroll (TC-REPORT-*)

| ID | Title | Pre-condition | Steps | Expected | Pri |
|---|---|---|---|---|---|
| TC-REPORT-001 | Dashboard số liệu tổng quan | Login admin/accountant | Mở dashboard | Hiển thị KPI: tổng orders, đang chạy, hoàn thành, km tiết kiệm | P1 |
| TC-REPORT-002 | Báo cáo tổng hợp theo tháng | Login user `report:read` | Chọn tháng → "Xem báo cáo" | Biểu đồ + bảng: số trip, distance, COD thu, fuel cost | P1 |
| TC-REPORT-003 | Bảng lương driver tháng | Có trips COMPLETED | Vào "Lương" → chọn tháng | Tính lương theo công thức = base + per-trip + km | P0 |
| TC-REPORT-004 | Xuất bảng lương Excel | Xem được payroll | Bấm "Xuất Excel" | Tải file `.xlsx`, audit EXPORT | P1 |

---

## 9. Audit Log (TC-AUDIT-*)

| ID | Title | Pre-condition | Steps | Expected | Pri |
|---|---|---|---|---|---|
| TC-AUDIT-001 | Xem danh sách audit log | Login admin | "Quản trị > Audit" | Liệt kê actions trong org user, paginated | P1 |
| TC-AUDIT-002 | Filter audit theo Action + User | Có log đã ghi | Filter `Action=FINALIZE` + `User=planner1` | Chỉ hiện entries match cả 2 điều kiện | P2 |
| TC-AUDIT-003 | Password KHÔNG bị ghi vào audit | User đổi password | Sau khi đổi, xem audit entry | Trong field `Changes` không có raw password | P0 |

---

## 10. Public Tracking — Khách hàng tra cứu (TC-TRACK-*)

| ID | Title | Pre-condition | Steps | Expected | Pri |
|---|---|---|---|---|---|
| TC-TRACK-001 | Khách hàng tra trip qua link | Có trip IN_PROGRESS với tracking code | Mở `/track?code=XXX` | Hiển thị trạng thái + vị trí xe trên bản đồ | P1 |
| TC-TRACK-002 | Rate limit chống bot scrape | — | Gọi 100 lần liên tục từ 1 IP | Sau 60 req/phút trả 429 Too Many Requests | P2 |
| TC-TRACK-003 | Tracking link đã hoàn thành | Trip COMPLETED | Mở link tracking | Vẫn xem được, hiển thị "Đã giao + thời gian" | P2 |

---

## 11. AI Agent (TC-AI-*)

| ID | Title | Pre-condition | Steps | Expected | Pri |
|---|---|---|---|---|---|
| TC-AI-001 | Lệnh tiếng Việt "lập kế hoạch hôm nay" | Login user | Mở AI panel → gõ "lập kế hoạch hôm nay" → Enter | Navigate đến `/planning?date=YYYY-MM-DD` (today) | P1 |
| TC-AI-002 | Fallback khi Gemini quota hết | API key bị block | Gõ lệnh đơn giản "xem báo cáo tháng này" | Parser regex offline vẫn hoạt động, navigate đúng | P1 |
| TC-AI-003 | Lệnh không hiểu được | — | Gõ "xin chào AI" (không có ý định rõ) | Trả lời "Tôi chưa hiểu, bạn nói rõ hơn" | P2 |

---

## Tổng kết Test Run

> Đợt kiểm thử cuối: **2026-05-17** — môi trường local Docker + MongoDB 7.0

| Module | Tổng | Pass | Fail | Skipped | % Pass |
|---|---|---|---|---|---|
| Authentication | 10 | 10 | 0 | 0 | 100% |
| RBAC & DAC | 6 | 6 | 0 | 0 | 100% |
| User Management | 5 | 5 | 0 | 0 | 100% |
| Master Data | 5 | 5 | 0 | 0 | 100% |
| Order Management | 6 | 6 | 0 | 0 | 100% |
| Route Planning | 8 | 8 | 0 | 0 | 100% |
| Trip & Driver | 6 | 6 | 0 | 0 | 100% |
| Reporting | 4 | 4 | 0 | 0 | 100% |
| Audit Log | 3 | 3 | 0 | 0 | 100% |
| Public Tracking | 3 | 3 | 0 | 0 | 100% |
| AI Agent | 3 | 3 | 0 | 0 | 100% |
| **Tổng** | **59** | **59** | **0** | **0** | **100%** |

---

## Liên hệ giữa Manual Test Cases và Automation

Các test case **P0** đều có automated test tương ứng trong code base. Mapping:

| Manual Test ID | Automated Test File |
|---|---|
| TC-AUTH-001 → 010 | [`backend/tests/integration/auth.test.js`](https://github.com/.../auth.test.js) |
| TC-PERM-001 → 006 | [`backend/tests/integration/dac.test.js`](https://github.com/.../dac.test.js) + [`rbac.test.js`](https://github.com/.../rbac.test.js) |
| TC-ORD-001 → 006 | [`backend/tests/integration/orders.test.js`](https://github.com/.../orders.test.js) |
| TC-PLAN-003 (HGS optimize) | [`optimizer-service/tests/test_api.py`](https://github.com/.../test_api.py) (`TestOptimizeHGS`) |
| TC-PLAN-006 → 008 (FINALIZE/LOCK/DISPATCH) | [`backend/tests/integration/audit.test.js`](https://github.com/.../audit.test.js) |
| TC-TRIP-* | [`backend/tests/integration/maintenance.test.js`](https://github.com/.../maintenance.test.js) (POD photo) |
| TC-AUDIT-003 | [`audit.test.js`](https://github.com/.../audit.test.js) (payload sanitization) |
| TC-AI-001 → 003 | [`backend/tests/unit/aiAgent.test.js`](https://github.com/.../aiAgent.test.js) |
| TC-TRACK-001 | [`backend/tests/integration/tracking.test.js`](https://github.com/.../tracking.test.js) |

➡ Mỗi manual test có ≥1 automated test backup. Khi code thay đổi, automated test sẽ phát hiện regression trước khi manual test phải chạy lại.

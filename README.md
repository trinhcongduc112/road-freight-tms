# Road Freight TMS

Hệ thống quản lý vận tải đường bộ đa khách (multi-tenant) cho doanh nghiệp logistics tại Việt Nam.
Đồ án tốt nghiệp — Trịnh Công Đức.

## Tính năng chính

- **Quản trị đa cấp** — Cây Organization (chi nhánh / kho / phòng ban) + RBAC + DAC scope filter theo cây.
- **Master Data** — Khách hàng, Sản phẩm, Phương tiện, Tài xế, Dịch vụ 3PL.
- **Đơn hàng** — Approval workflow (PENDING → APPROVED → REJECTED), Planning workflow (PENDING → PLANNED → LOCKED → FINALIZED), import Excel.
- **Lập kế hoạch + Tối ưu lộ trình** — OR-Tools VRP qua microservice Python (`optimizer-service`), tôn trọng tải trọng / thể tích / khung giờ / tương thích hàng hóa.
- **Giám sát Live Dispatch** — Bản đồ Leaflet realtime, GPS tài xế, timeline điểm giao, ePOD photo/signature, incident handling.
- **App tài xế (React Native + Expo)** — Workflow Nhận chuyến → Soạn hàng → Xuất kho → ePOD từng điểm → Về kho → Kết thúc.
- **Báo cáo & Kế toán** — Doanh thu, chi phí, COD, lãi gộp; xuất Excel đa sheet.
- **AI Agent (Gemini Function Calling)** — User ra lệnh tự nhiên, AI tự navigate trang + thao tác (vd "tải báo cáo tháng này", "lập kế hoạch hôm nay"). Pattern URL deep-link.
- **Trợ lý AI Hỏi đáp** — Chatbot kiến thức hệ thống + hand-off cho tư vấn viên qua email magic-link.
- **Đa ngôn ngữ** — VI / EN.

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js 20, Express, Mongoose 8, Socket.IO, jsonwebtoken, bcrypt, helmet, express-rate-limit |
| Database | MongoDB 7 |
| Optimizer | Python + Google OR-Tools (microservice) |
| AI | Google Gemini API (`gemini-2.5-flash-lite` default) |
| Web | React 19, Vite 5, Ant Design 5, TanStack Query 5, Zustand, React Router 7, Leaflet, Recharts, xlsx |
| Mobile | React Native (Expo SDK 54), React Navigation 7, expo-location, expo-image-picker, expo-secure-store |
| Email | nodemailer (SMTP Gmail) |

## Cấu trúc thư mục

```
TMS/
├── backend/                  Node.js + Express API
│   └── src/
│       ├── config/           env + db connection
│       ├── controllers/      logic theo module (auth, order, plan, trip, agent, support…)
│       ├── middlewares/      auth, rbac, dac, rateLimit, errorHandler, perfMonitor
│       ├── models/           Mongoose schemas (PascalCase đúng spec BA)
│       ├── routes/           Express routers
│       ├── services/         emailService, aiAgentService, aiAssistantService, tripService
│       ├── seed/             demo data generators
│       └── utils/            supportKnowledge, apiError, asyncHandler, logger
├── frontend-web/             React + Vite + Ant Design (Web Portal)
│   └── src/
│       ├── api/              axios wrappers theo domain
│       ├── components/       SupportChatWidget, AiAgentPanel
│       ├── features/         admin, auth, dashboard, master-data, orders, planning,
│       │                     monitoring, reporting, support
│       ├── layouts/          AppLayout
│       ├── store/            zustand authStore
│       ├── styles/           global.css
│       └── i18n.jsx          VI/EN dictionaries
├── frontend-app/             React Native + Expo (App tài xế)
│   └── src/{api,screens,navigation,components,store}
├── optimizer-service/        Python OR-Tools VRP microservice
├── docs/                     BA notes, ERD, deployment guides
├── docker-compose.yml        mongo + backend + frontend-web
├── Makefile                  install / dev / mobile / db
└── README.md
```

## Yêu cầu môi trường

- **Node.js 20** (bắt buộc — backend dùng `??=` operator + một số package yêu cầu ≥18.17).
- **MongoDB 7** (qua Docker hoặc cài local).
- **Python 3.11+** (cho `optimizer-service` — tuỳ chọn, có thể skip nếu chưa cần tối ưu thật).
- **Android emulator hoặc Expo Go trên điện thoại** (cho app tài xế — tuỳ chọn).
- (Khuyến nghị) `nvm` để switch giữa Node 20 và 14 nếu máy còn project cũ.

## Setup nhanh

```bash
# 1. Clone + vào thư mục project
git clone <repo-url> TMS && cd TMS

# 2. Switch sang Node 20
nvm use 20      # nếu dùng nvm; hoặc cài Node 20 trực tiếp

# 3. Cài deps cho backend + frontend-web + mobile
make install

# 4. Tạo .env cho backend
cp backend/.env.example backend/.env
# Mở backend/.env, điền các giá trị thật (xem mục Biến môi trường bên dưới)

# 5. Bật MongoDB (cách nhanh nhất qua Docker)
docker run -d --name road-freight-mongo -p 27017:27017 mongo:7

# 6. Seed dữ liệu mẫu
make seed

# 7. Chạy backend + web song song (Ctrl-C để dừng cả 2)
make dev

# 8. Để tối ưu hơn đã dùng 1 lệnh makefile để chạy cả font + back
make start  

```

Truy cập:
- Web Portal — <http://localhost:5173>
- Backend API — <http://localhost:5000/api>
- Health check — <http://localhost:5000/health>
- Metrics — <http://localhost:5000/api/system/metrics> (p50/p95/p99 + slow endpoints)

## Make targets (root)

| Lệnh | Mục đích |
|---|---|
| `make install` | Cài npm deps cho backend, frontend-web, frontend-app |
| `make mongo` | Bật/đảm bảo MongoDB container đang chạy |
| `make seed` | Seed dữ liệu mẫu (organization, user, master data, demo orders…) |
| `make dev` | Chạy backend + frontend-web song song (log gộp) |
| `make backend` | Chỉ backend (Node 20, watch mode) |
| `make web` | Chỉ frontend-web (Vite dev server) |
| `make mobile` | Expo dev qua LAN (QR code, scan bằng Expo Go) |
| `make mobile-localhost` | Expo cho emulator/simulator đứng trên cùng máy |
| `make mobile-android` | Expo + tự bật Android emulator nếu cần |
| `make mobile-ios` | Expo + iOS simulator (chỉ macOS) |
| `make mobile-stop` | Dừng Expo dev server |
| `make db-ui` | Mở Mongo Express GUI ở <http://localhost:8081> |
| `make db` | Mongo shell vào DB `road_freight` |
| `make logs` | Tail log backend + frontend khi chạy nền |
| `make stop` | Tắt tất cả service đang chạy |
| `make clean` | Xoá node_modules + reinstall (khi nghi dependency hỏng) |
| `make help` | In bảng targets |

## Biến môi trường ([backend/.env](backend/.env))

| Biến | Bắt buộc? | Mô tả |
|---|---|---|
| `NODE_ENV` | ✓ | `development` / `production` |
| `PORT` | ✓ | Default `5000` |
| `MONGODB_URI` | ✓ | `mongodb://localhost:27017/road_freight` |
| `JWT_SECRET` | ✓ | Random ≥32 ký tự cho production |
| `JWT_EXPIRES_IN` | ✓ | Default `7d` |
| `FRONTEND_URL` | ✓ | URL frontend-web để set CORS + magic-link |
| `UPLOAD_DIR` | ○ | Default `uploads` |
| `SMTP_HOST/PORT/USER/PASS/FROM` | ○ | Cần khi muốn gửi email thật (invite user, contact form, AI handoff). Để rỗng → log ra console + ghi `./tmp/emails/` |
| `GEMINI_API_KEY` | ○ | Cần cho Hỏi đáp + AI Agent. Lấy free tại <https://aistudio.google.com/app/apikey> |
| `GEMINI_MODEL` | ○ | Default `gemini-2.5-flash-lite` (free tier 1000 req/ngày). Đừng dùng `gemini-2.5-flash` (chỉ 20 RPD) |
| `PERF_SLOW_THRESHOLD_MS` | ○ | Default 500. Vượt → log WARN `[perf] SLOW` |

## App tài xế (mobile)

```bash
# Cách 1: Android emulator (đã setup AVD trên máy)
make mobile-android

# Cách 2: Điện thoại thật + Expo Go (cùng wifi với máy chạy backend)
make mobile               # QR code hiện ra, scan bằng Expo Go

# Cách 3: iOS simulator (macOS only)
make mobile-ios
```

App tự nhận IP backend qua Metro bundler. Override bằng:
```bash
EXPO_PUBLIC_API_URL=http://192.168.1.x:5000/api make mobile
```

## Workflow nghiệp vụ chính

```
1. Đơn hàng     : NEW → PENDING (approval) → APPROVED → PLANNED → LOCKED → FINALIZED → DELIVERED
2. Lộ trình     : DRAFT → PLANNED (optimized) → LOCKED → FINALIZED
3. Chuyến chạy  : ASSIGNED → DRIVER_CONFIRMED → LOADING → IN_PROGRESS → RETURNING → COMPLETED
4. ePOD         : Mỗi điểm dừng → COMPLETED (ảnh + chữ ký) hoặc FAILED (note lý do)
5. Sự cố        : Tài xế báo (kẹt xe / hỏng xe / tai nạn) → Dispatcher ACKNOWLEDGED → RESOLVED
```

## AI Agent & Hỏi đáp — Cách dùng

### Hỏi đáp (icon `?` ở sidebar)
- Chat hỏi về cách dùng hệ thống: "Làm sao xuất báo cáo tháng?", "Quy trình giao hàng trên app?".
- AI dùng Gemini + knowledge base ở [`backend/src/utils/supportKnowledge.js`](backend/src/utils/supportKnowledge.js).
- Bấm **Gặp tư vấn viên** → gửi email kèm magic link cho support team → support trả lời qua web page, tin nhắn đẩy real-time về chat user.

### AI Agent (icon 🤖 ở sidebar)
- Ra lệnh tự nhiên, AI tự thao tác:
  - "Tải báo cáo tháng này" → mở `/reports?period=month&autoExport=1` → auto xuất Excel.
  - "Lập kế hoạch hôm nay" → mở `/planning?date=...&autoCreate=1` → auto tạo plan + tối ưu tuyến.
  - "Xem đơn chờ duyệt" → mở `/orders?approvalStatus=PENDING`.
  - "Mở giám sát ngày 15/05" → mở `/monitoring?date=2026-05-15`.
- Mở rộng tool: thêm vào [`backend/src/services/aiAgentService.js`](backend/src/services/aiAgentService.js) (declaration + `functionCallToAction`) + wire page đích đọc URL query.

## Chạy bằng Docker (production-like)

```bash
docker compose up -d
# Seed 1 lần đầu:
docker exec -it road-freight-backend node src/seed/seed.js
```

- Web: <http://localhost:8080>
- Backend: <http://localhost:5000>

## Smoke test API

```bash
# Login (lấy JWT)
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"Email":"admin@road-freight.io","Password":"Pass@123"}' | jq -r .data.token)

# Cây tổ chức
curl -s http://localhost:5000/api/organizations/tree \
  -H "Authorization: Bearer $TOKEN" | jq

# AI Agent
curl -s -X POST http://localhost:5000/api/agent/execute \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"command":"tải báo cáo tháng này"}' | jq

# Metrics
curl -s http://localhost:5000/api/system/metrics | jq
```

## Đáp ứng ISO 25010

| Đặc tính | Cách triển khai |
|---|---|
| **Performance** — API <500ms | Middleware [`perfMonitor.js`](backend/src/middlewares/perfMonitor.js) đo p50/p95/p99, log WARN khi > ngưỡng |
| **Performance** — GPS 5–30s | `expo-location.watchPositionAsync` với `timeInterval` + `distanceInterval` (config theo nhu cầu) |
| **Reliability** — Fault Tolerance | Mobile có thể queue GPS vào AsyncStorage khi mất mạng + auto-sync (tuỳ phiên bản) |
| **Security** — Auth | JWT 7d + bcrypt salt 10 |
| **Security** — Multi-tenant | DAC middleware ([`dac.js`](backend/src/middlewares/dac.js)) gắn `req.orgScope`, mọi query filter theo cây Org |
| **Usability** — Touch target ≥44dp | App tài xế bump các button chính có `minHeight: 44` |
| **Compatibility** — Browser | Vite + antd 5 (auto polyfill Chrome/Edge/Safari) |
| **Compatibility** — OS | Expo SDK 54 (Android + iOS) |
| **Portability** — Cloud | Dockerfile + docker-compose, 12-factor env config |
| **Maintainability** | Modular controllers/services + Mongoose schema linh hoạt |

## Quy ước code

- Tên trường Mongoose: **PascalCase** đúng spec BA (`XCode`, `XName`, `OrganizationIDs`, `IsSuperAdmin`).
- Component React: PascalCase (`OrdersPage.jsx`).
- API response chuẩn: `{ success, data?, message?, error? }`.
- ESM (`type: module`) ở cả backend và frontend.
- Comment chỉ viết khi giải thích **why**, không lặp lại what.

## License

Đồ án nghiên cứu — không phát hành thương mại.

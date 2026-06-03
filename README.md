# Road Freight TMS

Hệ thống quản lý vận tải đường bộ đa khách (multi-tenant) cho doanh nghiệp logistics tại Việt Nam.
Đồ án tốt nghiệp — Trịnh Công Đức.

🌐 **Live demo**: <https://ductms.id.vn>
📚 **User Docs**: <https://docs.ductms.id.vn>
📦 **Tracking (public)**: <https://track.ductms.id.vn>

## Tính năng chính

- **Quản trị đa cấp** — Cây Organization (chi nhánh / kho / phòng ban) + RBAC + DAC scope filter theo cây.
- **Master Data** — Khách hàng, Sản phẩm, Phương tiện, Tài xế, Dịch vụ 3PL.
- **Đơn hàng** — Approval workflow (PENDING → APPROVED → REJECTED), Planning workflow (PENDING → PLANNED → LOCKED → FINALIZED), import Excel.
- **Lập kế hoạch + Tối ưu lộ trình** — Tự implement **HGS-CVRP** (Hybrid Genetic Search, Vidal 2022) + 2 baseline **LNS+SA** và **NN+2opt** để benchmark, qua microservice Python (`optimizer-service`). Tôn trọng tải trọng / thể tích / khung giờ / tương thích hàng hóa. Áp dụng mô hình tắc đường empirical 4 lớp tự học (theo giờ × thứ × vùng + crowdsource từ tài xế).
- **ETA cascade** — Tài xế hoàn thành 1 điểm sớm/muộn → ETA các điểm sau tự cập nhật (threshold ±20p late / ±60p early), bắt khai báo lý do nếu lệch ngoài ngưỡng.
- **Giám sát Live Dispatch** — Bản đồ Leaflet realtime, GPS tài xế qua Socket.IO, timeline điểm giao, ePOD photo/signature, incident handling + delay request.
- **Trang tra cứu công khai** — Khách nhập mã đơn → xem vị trí xe + ETA + ảnh giao hàng, không cần login (subdomain `track.*`).
- **App tài xế (React Native + Expo)** — Workflow Nhận chuyến → Soạn hàng → Xuất kho → ePOD từng điểm → Báo cáo sự cố → Về kho → Kết thúc.
- **Báo cáo & Kế toán** — Doanh thu, chi phí, COD, lãi gộp; xuất Excel đa sheet.
- **AI Agent (Gemini Function Calling)** — User ra lệnh tự nhiên, AI tự navigate trang + thao tác (vd "tải báo cáo tháng này", "lập kế hoạch hôm nay"). Pattern URL deep-link.
- **Trợ lý AI Hỏi đáp** — Chatbot kiến thức hệ thống + hand-off cho tư vấn viên qua email magic-link.
- **Đa ngôn ngữ** — VI / EN.
- **Observability** — Sentry error tracking (optional), perfMonitor middleware đo p50/p95/p99, audit log.
- **Cache layer** — Redis distributed cache + rate-limit, throughput tăng 4-5× cho endpoint đọc nhiều.

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js 20, Express, Mongoose 8, Socket.IO, jsonwebtoken, bcrypt, helmet, express-rate-limit |
| Database | MongoDB 7 |
| Cache | Redis 7 (alpine, LRU 256MB) |
| Optimizer | Python (FastAPI), tự implement HGS-CVRP + LNS-SA + NN+2opt (microservice) |
| AI | Google Gemini API (`gemini-2.5-flash-lite` default) |
| Web | React 19, Vite 5, Ant Design 5, TanStack Query 5, Zustand, React Router 7, Leaflet, Recharts, xlsx, react-helmet-async |
| Mobile | React Native (Expo SDK 54), React Navigation 7, expo-location, expo-image-picker, expo-secure-store |
| Docs | Docusaurus 3 (deploy chung container) |
| Observability | Sentry (Node + React), morgan, custom perfMonitor + audit middleware |
| Deploy | Docker Compose, Nginx reverse proxy, Let's Encrypt SSL, AWS EC2 |
| Email | nodemailer (SMTP Gmail) |

## Cấu trúc thư mục

```
TMS/
├── backend/                  Node.js + Express API
│   ├── src/
│   │   ├── config/           env, db, sentry
│   │   ├── controllers/      logic theo module (auth, order, plan, trip, agent, support…)
│   │   ├── middlewares/      auth, rbac, dac, rateLimit, errorHandler, perfMonitor, audit
│   │   ├── models/           Mongoose schemas (PascalCase đúng spec BA)
│   │   ├── routes/           Express routers
│   │   ├── services/         emailService, aiAgentService, etaService, trafficFactorService
│   │   ├── jobs/             cron jobs (trafficFactorJob)
│   │   ├── seed/             demo data generators
│   │   └── utils/            supportKnowledge, apiError, asyncHandler, logger
│   ├── uploads/              ePOD images (bind mount trong production)
│   ├── .env.example          dev env template
│   └── .env.production.example  prod env template
├── frontend-web/             React + Vite + Ant Design (Web Portal)
│   └── src/{api,components,features,layouts,store,utils,styles}
├── frontend-app/             React Native + Expo (App tài xế)
├── optimizer-service/        Python HGS-CVRP + baselines (FastAPI)
├── docs-site/                Docusaurus user docs (deploy ở docs.ductms.id.vn)
├── docs/                     BA notes, ERD, thesis chapters
├── e2e/                      Playwright E2E tests
├── scripts/                  backup-mongo.sh, restore-mongo.sh, nginx template, benchmark
├── backups/                  Backup output (gitignored)
│   ├── mongo/                DB snapshots (.tar.gz)
│   └── uploads/              ePOD image archives (.tar.gz)
├── docker-compose.yml        dev stack (mongo + backend + frontend-web)
├── docker-compose.prod.yml   production stack (+ redis, optimizer, docs, nginx)
├── deploy.env                production DOMAIN + EMAIL (committed)
├── Makefile                  install / dev / prod / mobile / backup / test
└── README.md
```

## Yêu cầu môi trường

- **Node.js 20** (bắt buộc).
- **Docker + Docker Compose** (cho MongoDB 7 + Redis 7 — tự khởi qua `make start`).
- **Python 3.11+** (cho `optimizer-service`).
- **Android emulator hoặc Expo Go** (cho app tài xế).
- (Khuyến nghị) `nvm` để switch giữa Node 20 và các version khác.

---

## 🚀 Setup local (dev)

```bash
git clone <repo-url> TMS && cd TMS
nvm use 20
make install
cp backend/.env.example backend/.env       # điền giá trị thật

make start            # mongo + backend + frontend-web (kèm log)
make seed             # seed dữ liệu mẫu
make mobile-android   # (optional) app tài xế qua Android emulator
```

Truy cập:

| URL | Mục đích |
|---|---|
| <http://localhost:5173> | Web Portal |
| <http://localhost:5000/api> | Backend API |
| <http://localhost:5000/api-docs> | Swagger UI |
| <http://localhost:5000/health> | Health check |
| <http://localhost:5000/api/system/metrics> | p50/p95/p99 + slow endpoints |
| <http://localhost:3000> | Docs (sau `make docs-local`) |

---

## 🌍 Setup production (server EC2 mới)

```bash
git clone <repo-url> road-freight-tms && cd road-freight-tms
sudo apt install -y docker.io docker-compose-plugin nginx make openssl jq

make deploy-prod      # 1 lệnh: init + start + nginx + SSL
make seed-prod        # seed data mẫu (chạy 1 lần)
```

`make deploy-prod` tự:
1. Tạo `backend/.env.production` (JWT/REFRESH random + URL HTTPS + CORS 5 subdomain)
2. Build + start 6 container Docker (mongo, redis, optimizer, backend, web, docs)
3. Cài Nginx reverse proxy cho 5 subdomain
4. Cài SSL Let's Encrypt cho cả 5

Cập nhật code sau này:
```bash
make update-prod      # git pull + rebuild + restart TẤT CẢ
# Hoặc chỉ rebuild 1 service:
make update-web
make update-backend
make update-docs
```

Cấu hình DOMAIN/EMAIL trong [`deploy.env`](deploy.env) — sửa 2 dòng nếu fork hoặc đổi domain.

---

## 💾 Backup & Restore

### Backup tự động

```bash
make backup-all       # backup cả DB + ảnh ePOD
```

Output:
- `backups/mongo/road_freight-YYYY-MM-DD_HHMMSS.tar.gz` — snapshot DB (`mongodump --gzip`)
- `backups/uploads/uploads-YYYY-MM-DD_HHMMSS.tar.gz` — nén ảnh ePOD

Retention 14 ngày tự xóa bản cũ. Optional upload S3 nếu set `BACKUP_S3_BUCKET` trong env.

### Cron hằng đêm (server)

```bash
crontab -e
# Thêm dòng:
0 0 * * * cd /home/ubuntu/road-freight-tms && make backup-all >> /var/log/tms-backup.log 2>&1
```

### Restore

```bash
bash scripts/restore-mongo.sh backups/mongo/road_freight-2026-05-27_000000.tar.gz
# Ảnh:
tar -xzf backups/uploads/uploads-2026-05-27_000000.tar.gz -C backend/
```

---

## Make targets

### Local dev
| Lệnh | Mục đích |
|---|---|
| `make install` | Cài npm deps cho backend, frontend-web, frontend-app, docs-site |
| `make start` | Chạy mongo + redis (Docker) + backend + frontend-web (host, kèm tail log) |
| `make dev` | Chạy nền, không tail log |
| `make stop` | Dừng backend + frontend |
| `make seed` | Seed dữ liệu mẫu |
| `make mobile-android` | Expo + Android emulator |
| `make mobile` | Expo QR code (điện thoại cùng wifi) |
| `make docs-local` | Build + serve Docusaurus tại :3000 |
| `make db-ui` | Mongo Express GUI tại :8082 |

### Production
| Lệnh | Mục đích |
|---|---|
| `make deploy-prod` | ★★ Deploy 1 lệnh trên server mới (init + start + nginx + SSL) |
| `make update-prod` | git pull + rebuild + restart TẤT CẢ |
| `make update-web` | Rebuild riêng frontend-web (~2 phút) |
| `make update-backend` | Rebuild riêng backend |
| `make update-docs` | Rebuild riêng container docs |
| `make logs env=prod` | Tail log production stack |
| `make prod-status` | Container status |
| `make exec-mongo` | mongosh vào DB production |

### Backup & Test
| Lệnh | Mục đích |
|---|---|
| `make backup-all` | Backup DB + ảnh ePOD |
| `make backup-mongo` | Chỉ backup MongoDB |
| `make backup-uploads` | Chỉ backup ảnh ePOD |
| `make test` | Backend + Frontend + Optimizer test |
| `make test-coverage` | Coverage report 3 service |
| `make test-e2e` | Playwright E2E |

### Build APK
| Lệnh | Mục đích |
|---|---|
| `make release-apk` | ★ Build cloud + tải APK về (~15 phút) |

`make help` để xem đầy đủ.

---

## Biến môi trường

### Dev — [`backend/.env`](backend/.env.example)

| Biến | Bắt buộc? | Mô tả |
|---|---|---|
| `NODE_ENV` | ✓ | `development` / `production` |
| `PORT` | ✓ | Default `5000` |
| `MONGODB_URI` | ✓ | `mongodb://localhost:27017/road_freight` |
| `REDIS_URL` | ○ | `redis://localhost:6379`. Rỗng → không cache (chạy chậm hơn) |
| `JWT_SECRET` | ✓ | Sinh ngẫu nhiên: `openssl rand -hex 32` |
| `REFRESH_JWT_SECRET` | ✓ | Tương tự JWT_SECRET nhưng dùng cho refresh token |
| `FRONTEND_URL` | ✓ | Set CORS + magic-link |
| `CORS_ORIGINS` | ○ | CSV nhiều domain (production multi-subdomain) |
| `SMTP_HOST/PORT/USER/PASS/FROM` | ○ | Để rỗng → backend skip mail feature |
| `GEMINI_API_KEY` | ○ | Để rỗng → AI Agent + Hỏi đáp tắt |
| `SENTRY_DSN` | ○ | Để rỗng → Sentry no-op |

### Production — [`backend/.env.production`](backend/.env.production.example)

`make init-prod` (gọi tự động bởi `make deploy-prod`) auto sinh JWT secrets + set FRONTEND_URL + CORS_ORIGINS từ `deploy.env`. SMTP/Gemini/Sentry để rỗng — backend graceful skip.

### Deploy config — [`deploy.env`](deploy.env)

```
DOMAIN=ductms.id.vn
EMAIL=ductuyetvoi@gmail.com
```

Sửa 2 dòng này nếu fork repo hoặc đổi domain. Makefile auto đọc.

---

## Workflow nghiệp vụ chính

```
1. Đơn hàng     : NEW → PENDING (approval) → APPROVED → PLANNED → LOCKED → FINALIZED → DELIVERED
2. Lộ trình     : DRAFT → PLANNED (optimized) → LOCKED → FINALIZED
3. Chuyến chạy  : ASSIGNED → DRIVER_CONFIRMED → LOADING → IN_PROGRESS → RETURNING → COMPLETED
4. ePOD         : Mỗi điểm dừng → COMPLETED (ảnh + chữ ký) hoặc FAILED (note lý do)
5. Sự cố        : Tài xế báo (kẹt xe / hỏng xe / tai nạn / xin lùi giờ) → Dispatcher ACKNOWLEDGED → RESOLVED
6. ETA cascade  : Hoàn thành điểm sớm/muộn ≤ 20p → auto cascade; lệch nhiều → bắt khai báo lý do
```

---

## AI Agent & Hỏi đáp

### Hỏi đáp (icon `?` ở sidebar)
- Chat hỏi về cách dùng hệ thống.
- Gemini + knowledge base ở [`backend/src/utils/supportKnowledge.js`](backend/src/utils/supportKnowledge.js).
- **Gặp tư vấn viên** → email magic-link → support trả lời qua web page, push realtime về chat.

### AI Agent (icon 🤖 ở sidebar)
- Ra lệnh tự nhiên: "Tải báo cáo tháng này", "Lập kế hoạch hôm nay", "Xem đơn chờ duyệt".
- Implementation: [`backend/src/services/aiAgentService.js`](backend/src/services/aiAgentService.js) (Gemini function calling → URL deep-link).

---

## Smoke test API

```bash
TOKEN=$(curl -s -X POST https://ductms.id.vn/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"Email":"admin@road-freight.io","Password":"Pass@123"}' | jq -r .data.token)

curl -s https://ductms.id.vn/api/organizations/tree \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s https://ductms.id.vn/api/system/metrics | jq
```

---

## Đáp ứng ISO 25010

| Đặc tính | Cách triển khai |
|---|---|
| **Performance** — API <500ms | [`perfMonitor.js`](backend/src/middlewares/perfMonitor.js) đo p50/p95/p99 + Redis cache layer |
| **Performance** — GPS 5–30s | `expo-location.watchPositionAsync` config interval |
| **Reliability** — Backup | `mongodump --gzip` + tar uploads, retention 14 ngày, cron đêm |
| **Reliability** — Observability | Sentry error tracking + audit log + metrics endpoint |
| **Security** — Auth | JWT 15m access + 30d refresh, bcrypt salt 10 |
| **Security** — Multi-tenant | DAC middleware filter theo cây Org |
| **Security** — Transport | HTTPS Let's Encrypt cho cả 5 subdomain |
| **Usability** — Touch target ≥44dp | App tài xế các button chính `minHeight: 44` |
| **Compatibility** — Browser | Vite + antd 5 (Chrome/Edge/Safari/Firefox) |
| **Compatibility** — OS | Expo SDK 54 (Android + iOS) |
| **Portability** — Cloud | Docker Compose 12-factor + `make deploy-prod` 1 lệnh |
| **Maintainability** | Modular controllers/services + Mongoose schema linh hoạt |

---

## Quy ước code

- Tên trường Mongoose: **PascalCase** đúng spec BA (`XCode`, `XName`, `OrganizationIDs`, `IsSuperAdmin`).
- Component React: PascalCase (`OrdersPage.jsx`).
- API response chuẩn: `{ success, data?, message?, error? }`.
- ESM (`type: module`) ở cả backend và frontend.
- Comment chỉ viết khi giải thích **why**, không lặp lại what.

---

## License

Đồ án nghiên cứu — không phát hành thương mại.

# Road Freight TMS

> Đồ án "Xây dựng hệ thống quản lý và lập kế hoạch đường bộ cho các công ty vận tải".
> BA gốc: `docs/Trịnh Công Đức - Internship notes.pdf` — Chương 3 là spec ràng buộc cứng.

## Trạng thái sprint

| Sprint | Phạm vi | Trạng thái |
|---|---|---|
| **0** | Auth + Org tree + RBAC + DAC + Web Portal Quản trị | ✅ Done |
| **1** | Master Data (Customer, Product, Vehicle, Driver, Service) + Orders | ✅ Done |
| **2** | RoutePlan + DeliveryRoute + Dispatch board (Planned→Locked→Finalized) | ✅ Done |
| **3** | Mobile App (React Native) + WebSocket GPS + ePOD | ⏳ Plan |
| **4** | Monitoring map + Deviation Alert + Reporting | ⏳ Plan |

## Sprint 0 — Đã làm

### Backend (`backend/`)

- **Models đúng tên trường BA**: `Organization` (`XCode`, `XName`, `Parent`, `Path[]`),
  `RoleGroup` (`XCode`, `XName`, `Kind`, `Permissions[]`, `OrganizationID`),
  `User` (`UserName`, `Email`, `OrganizationIDs[]`, `RoleGroupID`, `IsSuperAdmin`).
- **3 lớp middleware**:
  - `auth.js`     — JWT verify, gắn `req.user` + `req.role`.
  - `rbac.js`    — kiểm tra theo permission code (BA 3.1.2).
  - `dac.js`     — gắn `req.orgScope` = subtree theo cây Org (BA 3.1.2).
- **API endpoints**:
  - `POST /api/auth/{register,login,logout}`, `GET /api/auth/me`
  - `GET /api/organizations`, `GET /tree`, full CRUD
  - `GET /api/role-groups/catalog`, full CRUD
  - `GET/POST/PUT/DELETE /api/users`
- **Seed**: 1 SuperAdmin + 1 Org gốc + 2 chi nhánh (HN, HCM) + 4 RoleGroup + 4 User mẫu.

### Frontend Web (`frontend-web/`)

- React 18 + Vite + **Ant Design 5** (theo BA 2.3.3) + TanStack Query + Zustand.
- Login page có hero panel + form chuẩn enterprise.
- AppLayout: sidebar dark + header + breadcrumb + user dropdown.
- 4 trang: Dashboard, Organizations (tree + table CRUD), RoleGroups (table + permission picker), Users (table + filter).

## Cấu trúc

```
ROAD_FREIGHT_SYSTEM/
├── backend/                      # Node.js + Express + Mongoose
│   └── src/{config,controllers,middlewares,models,routes,services,seed,utils,websockets}
├── frontend-web/                 # React + Vite + Ant Design (Web Portal)
│   └── src/{api,features,layouts,store,styles,utils}
├── frontend-app/                 # React Native (placeholder cho Sprint 3)
├── docs/                         # BA PDF + ERD + OpenAPI snapshots
├── docker-compose.yml            # mongo + backend + frontend-web
├── Makefile                      # install / dev / seed / docker-up
└── README.md
```

## Chạy local — 3 lệnh

```bash
# 1. Cài deps cho cả backend lẫn frontend-web
make install

# 2. Bật MongoDB (cách nhanh nhất)
docker run -d --name road-freight-mongo -p 27017:27017 mongo:7

# 3. Seed DB + chạy cả backend và web song song
cp backend/.env.example backend/.env
make seed
make dev
```

Mở trình duyệt:

- Web Portal: <http://localhost:5173>
- Backend API: <http://localhost:5000/api>
- Health check: <http://localhost:5000/health>

## Chạy bằng Docker (production-like)

```bash
make docker-up
# Trong terminal khác, seed DB (1 lần đầu):
docker exec -it road-freight-backend node src/seed/seed.js
```

- Web: <http://localhost:8080>
- Backend: <http://localhost:5000>

## Tài khoản seed

| Email | Password | Vai trò |
|---|---|---|
| superadmin@road-freight.io | Admin@123 | Original / SuperAdmin |
| admin@road-freight.io | Pass@123 | IT Admin @ VROUTE (Admin Group) |
| planner@road-freight.io | Pass@123 | Planner @ VROUTE-HN |
| driver01@road-freight.io | Pass@123 | Driver @ VROUTE-HN |
| accountant@road-freight.io | Pass@123 | Accountant @ VROUTE |

## Kiểm tra nhanh API (smoke test)

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"Email":"admin@road-freight.io","Password":"Pass@123"}' | jq -r .data.token)

# Cây tổ chức
curl -s http://localhost:5000/api/organizations/tree -H "Authorization: Bearer $TOKEN" | jq

# Tạo Org con mới
curl -s -X POST http://localhost:5000/api/organizations \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"XCode":"VROUTE-DN","XName":"Chi nhánh Đà Nẵng","ParentID":"<rootOrgId>"}' | jq
```

## Tham chiếu BA quan trọng

- 3.1.1 Kiến trúc phân cấp thực thể → `Organization.Parent` + `Path[]`.
- 3.1.2 RBAC + DAC → `middlewares/rbac.js` + `middlewares/dac.js`.
- 3.1.3 Admin Group / Normal Group → `RoleGroup.Kind`.
- 3.6.2 Bảng 3.7–3.9 → `models/Organization.js`, `RoleGroup.js`, `User.js`.
- 4.2.1 Cấu trúc thư mục `ROAD_FREIGHT_SYSTEM/` → đúng cây hiện tại.

## Quy ước code

- Tên trường model: **PascalCase** đúng spec BA (`XCode`, `XName`, `OrganizationIDs`, `IsSuperAdmin`).
- Component React: PascalCase (`OrganizationsPage.jsx`).
- API response chuẩn: `{ success, data?, message?, details? }`.
- ESM (`type: module`) ở cả backend và frontend.

# Deployment Guide — Road Freight TMS

Hệ thống được thiết kế để deploy lên cloud free-tier (Render + Vercel + MongoDB Atlas).

## Kiến trúc deploy

```
┌─────────────────────┐         ┌──────────────────────┐
│  Vercel (Frontend)  │  HTTPS  │  Render Web Service  │
│  frontend-web build │ ──────► │  Backend Node.js     │
└─────────────────────┘         └──────────┬───────────┘
                                           │
                              ┌────────────┴───────────┐
                              ▼                        ▼
                   ┌────────────────────┐   ┌──────────────────────┐
                   │ MongoDB Atlas      │   │  Render Web Service  │
                   │ (Free M0 cluster)  │   │  Optimizer (Python)  │
                   └────────────────────┘   └──────────────────────┘
```

## 1. Backend → Render

1. Tạo Web Service mới ở https://dashboard.render.com
2. Connect GitHub repo này, branch `main`
3. Build Command: `cd backend && npm ci`
4. Start Command: `cd backend && npm start`
5. Environment Variables:
   - `NODE_ENV=production`
   - `PORT=10000`
   - `MONGODB_URI=mongodb+srv://...` (từ Atlas)
   - `JWT_SECRET=<random 64 chars>`
   - `REFRESH_JWT_SECRET=<random 64 chars>`
   - `FRONTEND_URL=https://<your-vercel>.vercel.app`
   - `GEMINI_API_KEY=...`
   - `GEMINI_MODEL=gemini-2.5-flash-lite`
6. Sau khi tạo xong, vào Settings → **Deploy Hook** → copy URL → lưu vào GitHub Secret `RENDER_BACKEND_HOOK`

## 2. Optimizer → Render

1. Tương tự, tạo Web Service mới
2. Build Command: `cd optimizer-service && pip install -r requirements.txt`
3. Start Command: `cd optimizer-service && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Copy Deploy Hook → `RENDER_OPTIMIZER_HOOK`
5. Vào backend service → set env `OPTIMIZER_SERVICE_URL=https://<optimizer-name>.onrender.com`

## 3. Frontend → Vercel

1. Login https://vercel.com với GitHub
2. Import repo này, set **Root Directory** = `frontend-web`
3. Framework Preset: Vite
4. Environment Variables:
   - `VITE_API_URL=https://<backend-name>.onrender.com/api`
5. Tạo token tại Settings → Tokens → lưu vào `VERCEL_TOKEN`

## 4. MongoDB Atlas

1. Tạo cluster M0 (free) tại https://cloud.mongodb.com
2. Network Access → Allow `0.0.0.0/0` (vì Render IP dynamic)
3. Database User → tạo user, copy connection string
4. Dán vào `MONGODB_URI` của backend service

## 5. GitHub Secrets cần cấu hình

| Secret | Mô tả |
|--------|-------|
| `RENDER_BACKEND_HOOK` | Deploy hook URL của backend service |
| `RENDER_OPTIMIZER_HOOK` | Deploy hook URL của optimizer service |
| `VERCEL_TOKEN` | Token cá nhân Vercel |
| `PROD_API_URL` | (Optional) URL backend production |

Sau khi cấu hình xong, mỗi `git push origin main` sẽ tự động:
1. Chạy test backend
2. Build frontend
3. Trigger deploy lên Render + Vercel

## Tiết kiệm chi phí

Free tier hoạt động được nhưng:
- Render free service **sleep sau 15 phút** không request → cold start 30-60s
- Atlas M0 giới hạn 512MB
- Vercel free 100GB bandwidth/tháng

Đủ cho demo + đồ án. Production thật cần upgrade.

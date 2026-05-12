# Deployment Guide

## Recommended Cloud Layout

- **Frontend**: Vercel
- **Backend**: Render / Railway / Heroku
- **Database**: MongoDB Atlas
- **Object storage (production ePOD)**: S3-compatible bucket (Cloudflare R2, AWS S3, MinIO)

## Backend Environment Variables

```bash
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/vroute_tms
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://<frontend-domain>
UPLOAD_DIR=uploads
AI_PROVIDER=local
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

## Frontend Environment Variables

```bash
VITE_API_URL=https://<backend-domain>/api
```

## Production Notes

1. Use MongoDB Atlas indexes from Mongoose schemas.
2. Replace local `uploads/` with cloud object storage before going live with real ePOD images.
3. Rotate `JWT_SECRET` and never commit `.env`.
4. Enable HTTPS and CORS only for trusted frontend domains.
5. Keep Swagger UI protected or disabled if exposing a public production API.

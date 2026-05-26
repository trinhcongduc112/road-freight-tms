# Observability & Backup — hướng dẫn setup

Tài liệu cho **người vận hành** (admin/devops) — không phải developer. Setup 3 thứ free để hệ thống đạt chuẩn production cơ bản:

1. **Sentry** — error tracking (5xx + uncaught exception)
2. **UptimeRobot** — uptime monitor (ping `/health` mỗi 5 phút, alert qua email/SMS khi down)
3. **Cron backup MongoDB** — backup hàng đêm + giữ 14 ngày

Tổng thời gian setup: ~30 phút. Tất cả free, không cần thẻ tín dụng.

---

## 1. Sentry — Error tracking

### Setup

1. Đăng ký tài khoản https://sentry.io (free 5K errors/month)
2. **Create Project** → chọn `Node.js` (cho backend)
3. Settings → Client Keys (DSN) → copy DSN dạng `https://abc@oXXX.ingest.sentry.io/123`
4. Trên EC2:
   ```bash
   nano ~/road-freight-tms/backend/.env.production
   # Thêm dòng:
   SENTRY_DSN=https://abc@oXXX.ingest.sentry.io/123

   docker compose -f docker-compose.prod.yml restart backend
   ```

5. **Lặp lại cho frontend** — Create Project (React), copy DSN, sửa `docker-compose.prod.yml` thêm build arg:
   ```yaml
   frontend-web:
     build:
       args:
         VITE_API_URL: /api
         VITE_SENTRY_DSN: https://xyz@oXXX.ingest.sentry.io/456
   ```
   Rồi rebuild: `docker compose -f docker-compose.prod.yml up -d --build frontend-web`

### Verify

Trigger 1 lỗi để test:
```bash
curl http://47.129.225.75:8080/api/intentional-error-for-sentry-test
```
→ Vào Sentry dashboard sau ~30 giây thấy event mới.

### Alert qua email

Sentry → Project Settings → **Alerts** → tạo rule "When a new issue is created → Send notification to your email".

---

## 2. UptimeRobot — Uptime monitor + Alert

Public-facing endpoint `/health` được monitor mỗi 5 phút. Khi server down → email/SMS/Telegram cảnh báo trong vòng 1-2 phút.

### Setup

1. Đăng ký https://uptimerobot.com (free 50 monitor, check mỗi 5 phút)
2. **Add New Monitor**:
   - Type: **HTTP(s)**
   - Friendly name: `Road Freight TMS — Backend`
   - URL: `http://47.129.225.75:8080/health`
   - Monitoring interval: 5 phút
3. **My Settings** → Alert Contacts → thêm email/SMS/Telegram bot
4. Quay lại monitor → tick alert contacts

### Verify

Tắt thử container backend 10 giây:
```bash
docker compose -f docker-compose.prod.yml stop backend
sleep 10
docker compose -f docker-compose.prod.yml start backend
```
→ Sau ~5-7 phút sẽ nhận được email "Monitor is DOWN" + "Monitor is back UP".

### Bonus: monitor thêm Docs container

Thêm monitor thứ 2: `http://47.129.225.75:8081/` — đảm bảo user docs cũng được biết khi down.

---

## 3. Cron backup MongoDB

Backup full database mỗi 2h sáng, giữ 14 ngày gần nhất, optional upload S3.

### Setup local cron (đơn giản nhất)

Trên EC2:
```bash
crontab -e
```

Thêm dòng:
```cron
# Backup MongoDB road_freight mỗi 2h sáng UTC (= 9h sáng VN)
0 2 * * * cd /home/ubuntu/road-freight-tms && bash scripts/backup-mongo.sh >> /var/log/tms-backup.log 2>&1
```

### Verify

Chạy ngay 1 lần:
```bash
cd ~/road-freight-tms
make backup-mongo
ls -lh backups/
```

→ Phải thấy file `road_freight-YYYY-MM-DD_HHMMSS.tar.gz` ~5-50 MB.

### Restore (khi cần)

```bash
bash scripts/restore-mongo.sh backups/road_freight-2026-05-25_020000.tar.gz
# Confirm "yes" khi hỏi
```

### Bonus: upload S3 (optional)

Nếu muốn backup off-site (an toàn khi EC2 cháy):
```bash
# 1 lần: cài AWS CLI + cấu hình credential
sudo apt install -y awscli
aws configure   # nhập Access Key + Secret + region

# Tạo S3 bucket (free tier 5GB)
aws s3 mb s3://tms-mongo-backups

# Mỗi lần backup, set env trước:
BACKUP_S3_BUCKET=tms-mongo-backups bash scripts/backup-mongo.sh
```

Hoặc thêm vào crontab:
```cron
0 2 * * * cd /home/ubuntu/road-freight-tms && BACKUP_S3_BUCKET=tms-mongo-backups bash scripts/backup-mongo.sh >> /var/log/tms-backup.log 2>&1
```

---

## 4. Checklist sau khi setup

- [ ] Sentry dashboard nhận được test error (backend + frontend)
- [ ] UptimeRobot báo "UP" cho `/health`
- [ ] Alert email Sentry/UptimeRobot vào hộp thư cá nhân
- [ ] `make backup-mongo` chạy được, có file trong `backups/`
- [ ] `crontab -l` show có dòng backup cron
- [ ] (Optional) S3 bucket có file backup

---

## Khi giảng viên hỏi

> "Làm sao em biết khi production lỗi?"

→ "Em tích hợp **Sentry** track mọi 5xx + uncaught exception, **UptimeRobot** ping health endpoint mỗi 5 phút. Khi có incident, em nhận alert qua email trong vòng 1-2 phút và xem stack trace + breadcrumb trên Sentry để debug. Cả 2 đều free tier đủ dùng."

> "Server cháy mất data thì sao?"

→ "**Cron backup MongoDB hàng đêm**, giữ 14 ngày gần nhất tại `/backups/` trên EC2 + optional upload S3. Có **restore script** `scripts/restore-mongo.sh` để rollback < 5 phút. Trong roadmap, em chuyển sang **MongoDB Atlas** có **point-in-time recovery** built-in cho production thực."

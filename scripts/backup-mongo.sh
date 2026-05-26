#!/usr/bin/env bash
# Backup MongoDB của Road Freight TMS — chạy trong container tms-mongo.
#
# Cách dùng (1 lần): bash scripts/backup-mongo.sh
# Tự động (cron):    crontab -e
#                    0 2 * * * cd /home/ubuntu/road-freight-tms && bash scripts/backup-mongo.sh >> /var/log/tms-backup.log 2>&1
#
# Output:  backups/road_freight-YYYY-MM-DD_HHMMSS.tar.gz   (~5-50 MB nén)
# Retention: tự xoá bản > 14 ngày.
#
# Restore:
#   tar -xzf backups/<file>.tar.gz -C /tmp/restore
#   docker exec -i tms-mongo mongorestore --drop /tmp/restore/road_freight

set -euo pipefail

DB_NAME="${DB_NAME:-road_freight}"
CONTAINER="${MONGO_CONTAINER:-tms-mongo}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups/mongo}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
OUT="${BACKUP_DIR}/${DB_NAME}-${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

# Verify container đang chạy
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "✗ Container '${CONTAINER}' không chạy. Kiểm tra: docker ps"
  exit 1
fi

echo "→ Dump ${DB_NAME} từ ${CONTAINER}..."
# mongodump trong container ra stdout, pipe qua tar gzip ra host
docker exec "$CONTAINER" mongodump \
  --db="$DB_NAME" \
  --archive \
  --gzip \
  > "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo "✔ Backup: ${OUT} (${SIZE})"

# Dọn bản backup cũ > RETENTION_DAYS
echo "→ Dọn backup > ${RETENTION_DAYS} ngày..."
DELETED=$(find "$BACKUP_DIR" -name "${DB_NAME}-*.tar.gz" -type f -mtime "+${RETENTION_DAYS}" -delete -print | wc -l)
echo "✔ Đã xoá ${DELETED} bản cũ"

# Optional: upload S3 nếu có AWS CLI + bucket cấu hình
if [ -n "${BACKUP_S3_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  echo "→ Upload S3 s3://${BACKUP_S3_BUCKET}/..."
  aws s3 cp "$OUT" "s3://${BACKUP_S3_BUCKET}/mongo-backups/" --storage-class STANDARD_IA
  echo "✔ Đã upload S3"
fi

echo ""
echo "Tổng backup hiện có:"
ls -lhrt "$BACKUP_DIR" | tail -5

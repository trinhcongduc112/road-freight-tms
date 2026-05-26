#!/usr/bin/env bash
# Restore MongoDB từ file backup tạo bởi backup-mongo.sh
#
# Cách dùng:
#   bash scripts/restore-mongo.sh backups/mongo/road_freight-2026-05-25_020000.tar.gz
#
# ⚠️ Lệnh này sẽ DROP database hiện tại trước khi restore. Bỏ flag --drop trong code nếu muốn merge.

set -euo pipefail

BACKUP_FILE="${1:-}"
DB_NAME="${DB_NAME:-road_freight}"
CONTAINER="${MONGO_CONTAINER:-tms-mongo}"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file.tar.gz>"
  echo ""
  echo "Backup hiện có:"
  ls -lhrt backups/mongo/ 2>/dev/null || echo "  (chưa có backup nào)"
  exit 1
fi

echo "⚠️  Sắp DROP database '${DB_NAME}' và restore từ:"
echo "    ${BACKUP_FILE}"
read -p "Tiếp tục? (yes/N): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Huỷ."
  exit 0
fi

echo "→ Restore..."
docker exec -i "$CONTAINER" mongorestore \
  --drop \
  --archive \
  --gzip \
  < "$BACKUP_FILE"

echo "✔ Restore thành công"

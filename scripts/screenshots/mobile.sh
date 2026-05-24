#!/usr/bin/env bash
# Chụp màn hình từ Android emulator/device đang chạy.
# Cách dùng:
#   ./scripts/screenshots/mobile.sh app-login
#   ./scripts/screenshots/mobile.sh app-trip-detail
#
# Workflow:
#   1. Khởi động emulator + Expo: make mobile-android (terminal 1)
#   2. Mở app, navigate tới màn cần chụp
#   3. Chạy script: ./scripts/screenshots/mobile.sh <ten-file>
#   4. Ảnh lưu vào docs-site/static/img/screenshots/<ten-file>.png
set -e

NAME="${1:-}"
if [ -z "$NAME" ]; then
  echo "Thiếu tham số tên file."
  echo "Cách dùng: $0 <ten-file>  (không cần .png)"
  echo "Ví dụ:     $0 app-login"
  exit 1
fi

# Kiểm tra emulator đang chạy
if ! adb devices | grep -q "device$"; then
  echo "❌ Không thấy thiết bị Android. Chạy 'make mobile-android' trước."
  exit 1
fi

OUT_DIR="$(cd "$(dirname "$0")/../../docs-site/static/img/screenshots" && pwd)"
OUT_PATH="$OUT_DIR/${NAME}.png"

echo "📸 Chụp màn hình → $OUT_PATH ..."
adb exec-out screencap -p > "$OUT_PATH"

# Verify file size > 1KB (avoid empty captures)
SIZE=$(stat -c%s "$OUT_PATH" 2>/dev/null || stat -f%z "$OUT_PATH")
if [ "$SIZE" -lt 1024 ]; then
  echo "❌ File chụp ra quá nhỏ ($SIZE bytes) — có thể emulator chưa sẵn sàng."
  rm -f "$OUT_PATH"
  exit 1
fi

echo "✅ OK ($(numfmt --to=iec $SIZE 2>/dev/null || echo "$SIZE bytes"))"

#!/bin/bash
set -e

echo "=== ĐANG CHUYỂN ĐỔI SANG NODE 20 ==="
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 20 --silent
nvm use 20

echo "=== ĐANG TẮT CÁC TIẾN TRÌNH CŨ BỊ TREO ==="
pkill -f "node src/server" || true
pkill -f "vite" || true
sleep 1

echo "=== ĐANG XÓA RÁC CŨ VÀ CÀI LẠI THƯ VIỆN BACKEND ==="
cd backend
rm -rf node_modules package-lock.json
npm install --silent
cd ..

echo "=== ĐANG XÓA RÁC CŨ VÀ CÀI LẠI THƯ VIỆN FRONTEND ==="
cd frontend-web
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps --silent
cd ..

echo "=== ĐANG NẠP DỮ LIỆU DEMO ==="
cd backend
npm run seed
cd ..

echo ""
echo "✅ Tất cả đã sẵn sàng!"
echo "✅ Backend chạy tại: http://localhost:5000"
echo "✅ Web chạy tại:     http://localhost:5173"
echo ""

echo "=== KHỞI ĐỘNG DỰ ÁN ==="
make dev

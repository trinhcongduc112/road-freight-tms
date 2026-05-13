SHELL := /bin/bash
NVM  := export NVM_DIR="$$HOME/.nvm" && . "$$NVM_DIR/nvm.sh" && nvm use 20 --silent

LOG_BE     := /tmp/tms-backend.log
LOG_FE     := /tmp/tms-frontend.log
LOG_MOBILE := /tmp/tms-mobile.log

LOG_SERVICES := backend frontend-web optimizer mongo

.PHONY: help start stop mongo backend web dev seed logs logs-local logs-docker \
        logs-backend logs-web logs-optimizer install clean db-ui db \
        mobile mobile-android mobile-ios mobile-stop mobile-bg logs-mobile

help:
	@echo ""
	@echo "  ── Server ──────────────────────────────────────────────────────"
	@echo "  make start            — khởi động tất cả (MongoDB + backend + frontend)"
	@echo "  make dev              — chạy ngầm, không tail log"
	@echo "  make stop             — dừng backend + frontend"
	@echo "  make logs             — xem log realtime của dự án"
	@echo "  make logs-local       — xem log khi chạy bằng make dev/start"
	@echo "  make logs-docker      — xem log khi chạy bằng docker compose"
	@echo "  make logs-backend     — xem log backend"
	@echo "  make logs-web         — xem log frontend web"
	@echo "  make logs-optimizer   — xem log optimizer service"
	@echo "  ── Mobile App (Tài xế) ─────────────────────────────────────────"
	@echo "  make mobile           — Expo QR (Expo Go, mọi nền tảng)"
	@echo "  make mobile-bg        — Expo chạy ngầm + ghi log ra file"
	@echo "  make logs-mobile      — xem log Expo realtime (dùng với mobile-bg)"
	@echo "  make mobile-android   — Expo trực tiếp trên Android emulator"
	@echo "  make mobile-ios       — Expo trực tiếp trên iOS simulator (macOS)"
	@echo "  make mobile-stop      — dừng Expo dev server"
	@echo "  ── DB / Seed ───────────────────────────────────────────────────"
	@echo "  make seed             — reset DB và seed dữ liệu mẫu"
	@echo "  make db-ui            — Mongo Express tại http://localhost:8081"
	@echo "  make db               — mở mongosh"
	@echo "  ── Cài đặt ─────────────────────────────────────────────────────"
	@echo "  make install          — cài npm dependencies (backend + web + mobile)"
	@echo "  make clean            — xóa node_modules"
	@echo ""

start:
	@docker start road-freight-mongo
	@$(NVM) && cd backend && npm run dev > $(LOG_BE) 2>&1 & \
	$(NVM) && cd frontend-web && node_modules/.bin/vite --host 0.0.0.0 > $(LOG_FE) 2>&1 & \
	sleep 3 && \
	echo "" && \
	echo "  ✔ MongoDB   — Docker container" && \
	echo "  ✔ Backend   — http://localhost:5000/api" && \
	echo "  ✔ Frontend  — http://localhost:5173" && \
	echo "" && \
	echo "  Xem log: make logs   |   Dừng: make stop" && \
	echo "" && \
	tail -f $(LOG_BE) $(LOG_FE)

stop:
	@lsof -ti:5000,5173 | xargs -r kill && echo "Đã dừng backend + frontend" || echo "Không có process nào đang chạy"

mongo:
	docker start road-freight-mongo

backend:
	$(NVM) && cd backend && npm run dev

web:
	$(NVM) && cd frontend-web && node_modules/.bin/vite --host 0.0.0.0

dev: mongo
	@$(NVM) && cd backend && npm run dev > $(LOG_BE) 2>&1 & \
	$(NVM) && cd frontend-web && node_modules/.bin/vite --host 0.0.0.0 > $(LOG_FE) 2>&1 & \
	echo "" && \
	echo "  Backend  → http://localhost:5000/api" && \
	echo "  Frontend → http://localhost:5173" && \
	echo "" && \
	echo "  Xem log: make logs   |   Dừng: kill \$$(lsof -ti:5000,5173)" && \
	echo ""

logs:
	@files=""; \
	[ -f "$(LOG_BE)" ] && files="$$files $(LOG_BE)"; \
	[ -f "$(LOG_FE)" ] && files="$$files $(LOG_FE)"; \
	if [ -n "$$files" ] && lsof -ti:5000,5173 >/dev/null 2>&1; then \
		echo "Đang xem log local:$$files"; \
		tail -n 200 -f $$files; \
	elif docker compose ps -q backend >/dev/null 2>&1; then \
		echo "Đang xem log Docker Compose: $(LOG_SERVICES)"; \
		docker compose logs -f --tail=200 $(LOG_SERVICES); \
	elif [ -n "$$files" ]; then \
		echo "Không thấy process local đang chạy, hiển thị log file gần nhất:$$files"; \
		tail -n 200 -f $$files; \
	else \
		echo "Chưa có log. Dùng 'make dev' hoặc 'docker compose up -d' trước."; \
	fi

logs-local:
	@files=""; \
	[ -f "$(LOG_BE)" ] && files="$$files $(LOG_BE)"; \
	[ -f "$(LOG_FE)" ] && files="$$files $(LOG_FE)"; \
	if [ -z "$$files" ]; then \
		echo "Chưa có log local — chạy 'make dev' trước"; \
	else \
		tail -n 200 -f $$files; \
	fi

logs-docker:
	docker compose logs -f --tail=200 $(LOG_SERVICES)

logs-backend:
	@if [ -f "$(LOG_BE)" ] && lsof -ti:5000 >/dev/null 2>&1; then \
		tail -n 200 -f "$(LOG_BE)"; \
	elif docker compose ps -q backend >/dev/null 2>&1; then \
		docker compose logs -f --tail=200 backend; \
	elif [ -f "$(LOG_BE)" ]; then \
		tail -n 200 -f "$(LOG_BE)"; \
	else \
		echo "Chưa có log backend — chạy 'make dev' hoặc 'docker compose up -d' trước"; \
	fi

logs-web:
	@if [ -f "$(LOG_FE)" ] && lsof -ti:5173 >/dev/null 2>&1; then \
		tail -n 200 -f "$(LOG_FE)"; \
	elif docker compose ps -q frontend-web >/dev/null 2>&1; then \
		docker compose logs -f --tail=200 frontend-web; \
	elif [ -f "$(LOG_FE)" ]; then \
		tail -n 200 -f "$(LOG_FE)"; \
	else \
		echo "Chưa có log frontend-web — chạy 'make dev' hoặc 'docker compose up -d' trước"; \
	fi

logs-optimizer:
	@if docker compose ps -q optimizer >/dev/null 2>&1; then \
		docker compose logs -f --tail=200 optimizer; \
	else \
		echo "Optimizer chỉ có log khi chạy docker compose. Dùng 'docker compose up -d optimizer' trước."; \
	fi

seed: mongo
	$(NVM) && cd backend && npm run seed

install:
	$(NVM) && cd backend && npm install
	$(NVM) && cd frontend-web && npm install
	$(NVM) && cd frontend-app && npm install

# ── Mobile App ──────────────────────────────────────────────────────────────

mobile:
	@echo "  Khởi động Expo — quét QR bằng Expo Go trên điện thoại"
	@echo "  (Đảm bảo điện thoại và máy tính cùng mạng WiFi)"
	@echo ""
	$(NVM) && cd frontend-app && npx expo start

mobile-bg:
	@echo "  Khởi động Expo ngầm, log → $(LOG_MOBILE)"
	@$(NVM) && cd frontend-app && npx expo start > $(LOG_MOBILE) 2>&1 & \
	sleep 4 && \
	echo "" && \
	echo "  ✔ Expo đang chạy. Xem log: make logs-mobile" && \
	echo "  ✔ Quét QR trong log hoặc mở http://localhost:8081" && \
	echo ""

logs-mobile:
	@if [ ! -f $(LOG_MOBILE) ]; then \
		echo "Chưa có log Expo — chạy 'make mobile-bg' trước"; \
	else \
		tail -f $(LOG_MOBILE); \
	fi

mobile-android:
	@echo "  Khởi động Expo trên Android emulator..."
	$(NVM) && cd frontend-app && npx expo start --android

mobile-ios:
	@echo "  Khởi động Expo trên iOS simulator (chỉ dùng trên macOS)..."
	$(NVM) && cd frontend-app && npx expo start --ios

mobile-stop:
	@lsof -ti:8081,19000,19001,19002 | xargs -r kill 2>/dev/null && echo "Đã dừng Expo" || echo "Expo chưa chạy"

db-ui:
	@echo "Khởi động Mongo Express tại http://localhost:8081 ..."
	@MONGO_IP=$$(docker inspect road-freight-mongo --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}') && \
	docker rm -f road-freight-db-ui 2>/dev/null; \
	docker run -d --name road-freight-db-ui \
	  -p 8081:8081 \
	  -e ME_CONFIG_MONGODB_URL="mongodb://$$MONGO_IP:27017/" \
	  -e ME_CONFIG_BASICAUTH=false \
	  mongo-express:1 && \
	sleep 3 && echo "  Mở trình duyệt: http://localhost:8081"

db:
	docker exec -it road-freight-mongo mongosh road_freight

clean:
	rm -rf backend/node_modules frontend-web/node_modules frontend-app/node_modules

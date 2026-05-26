SHELL := /bin/bash
NVM  := export NVM_DIR="$$HOME/.nvm" && . "$$NVM_DIR/nvm.sh" && nvm use 20 --silent

LOG_BE     := /tmp/tms-backend.log
LOG_FE     := /tmp/tms-frontend.log
LOG_MOBILE := /tmp/tms-mobile.log
ANDROID_AVD := Pixel_6

# Production config — đọc DOMAIN + EMAIL từ deploy.env (commit cùng repo).
# Đổi domain? Sửa 2 dòng trong deploy.env, không cần đụng Makefile.
-include deploy.env

.PHONY: help start stop mongo backend web dev seed logs check \
        install clean db-ui db mobile mobile-android mobile-ios mobile-localhost mobile-stop \
        docs docs-install docs-build docs-local docs-deploy docs-stop api-docs api-docs-sync \
        build-mobile-android build-mobile-ios build-apk-cloud download-apk release-apk \
        test test-backend test-web test-optimizer test-coverage test-report \
        test-e2e test-e2e-ui test-e2e-headed test-e2e-report benchmark-cache backup-mongo restore-mongo \
        deploy-prod require-deploy-config init-prod start-prod stop-prod restart-prod logs-prod build-prod seed-prod prod-status \
        nginx-prod ssl-prod update-prod update-docs exec-backend exec-mongo

help:
	@echo ""
	@echo "  ── Web LOCAL DEV (Backend + Frontend qua nvm) ─────────────────"
	@echo "  make start            — chạy MongoDB + backend + frontend (kèm tail log)"
	@echo "  make dev              — chạy nền, không mở log"
	@echo "  make stop             — dừng backend + frontend"
	@echo "  make logs             — xem log dev   (alias: make logs env=dev)"
	@echo "  make logs env=prod    — xem log production stack"
	@echo "  make check env=dev    — kiểm tra biến môi trường dev"
	@echo "  make check env=prod   — kiểm tra biến môi trường production (ẩn secrets)"
	@echo "  ── PRODUCTION (Docker Compose trên server EC2 / VPS) ──────────"
	@echo "  make deploy-prod      — ★★ DEPLOY 1 LỆNH: init + start + nginx + SSL (lần đầu trên server mới)"
	@echo "  make update-prod      — ★ update sau lần deploy đầu: git pull + rebuild + restart"
	@echo "  make init-prod        — chỉ tạo .env.production + sinh secrets (deploy-prod gọi tự động)"
	@echo "  make start-prod       — build + start toàn bộ stack production"
	@echo "  make stop-prod        — dừng production stack"
	@echo "  make restart-prod     — restart sau khi update biến môi trường"
	@echo "  make build-prod       — rebuild image (sau khi git pull)"
	@echo "  make update-docs      — rebuild + restart riêng container docs"
	@echo "  make logs-prod        — tail log production"
	@echo "  make prod-status      — kiểm tra container đang Up?"
	@echo "  make seed-prod        — seed dữ liệu mẫu vào DB production"
	@echo "  make nginx-prod       — copy nginx config + reload (đọc DOMAIN từ deploy.env)"
	@echo "  make ssl-prod         — cài Let's Encrypt 5 subdomain (đọc DOMAIN + EMAIL từ deploy.env)"
	@echo "  make exec-backend     — vào shell backend container debug"
	@echo "  make exec-mongo       — mongosh vào DB production"
	@echo "  ── Mobile App (Tài xế) ─────────────────────────────────────────"
	@echo "  make mobile           — Expo QR (--lan) cho điện thoại thật cùng WiFi"
	@echo "  make mobile-localhost — Expo cho VM/emulator (--localhost)"
	@echo "  make mobile-android   — Expo + Android emulator"
	@echo "  make mobile-ios       — Expo + iOS simulator (macOS)"
	@echo "  make mobile-stop      — dừng Expo dev server"
	@echo "  ── Performance & Backup ────────────────────────────────────────"
	@echo "  make benchmark-cache  — đo RPS trước/sau Redis cache → benchmark-result.md"
	@echo "  make backup-mongo     — backup MongoDB → backups/*.tar.gz (chạy cron hàng ngày)"
	@echo "  make restore-mongo    — restore từ backup (bash scripts/restore-mongo.sh <file>)"
	@echo "  ── Build Mobile (APK/IPA file gửi giảng viên) ──────────────────"
	@echo "  make release-apk          — ★ build cloud + tải APK về máy (1 lệnh, ~15 phút)"
	@echo "  make build-apk-cloud      — chỉ build trên cloud Expo, không tải về"
	@echo "  make download-apk         — tải APK từ build cloud gần nhất (sau build-apk-cloud)"
	@echo "  make build-mobile-android — build APK local (cần Android SDK trên máy — không khuyến nghị)"
	@echo "  make build-mobile-ios     — build IPA local (macOS + Xcode)"
	@echo "  ── Tài liệu User Docs (Docusaurus) ─────────────────────────────"
	@echo "  make docs-local       — build + serve production tại http://localhost:3000  ★ recommended"
	@echo "  make docs             — dev mode (live-reload, NHƯNG search + EN locale không chạy)"
	@echo "  make docs-build       — build bundle vào docs-site/build"
	@echo "  make docs-stop        — dừng docs server"
	@echo "  ── DB / Seed ───────────────────────────────────────────────────"
	@echo "  make seed             — reset DB và seed dữ liệu mẫu"
	@echo "  make db-ui            — Mongo Express tại http://localhost:8082"
	@echo "  make db               — mở mongosh"
	@echo "  ── Cài đặt ─────────────────────────────────────────────────────"
	@echo "  make install          — cài npm deps (backend + web + mobile + docs)"
	@echo "  make docs-install     — chỉ cài deps cho docs-site"
	@echo "  make clean            — xóa node_modules"
	@echo "  ── Test ────────────────────────────────────────────────────────"
	@echo "  make test             — chạy hết test 3 service (backend + web + optimizer)"
	@echo "  make test-backend     — Jest + Supertest + mongodb-memory-server"
	@echo "  make test-web         — Vitest + React Testing Library"
	@echo "  make test-optimizer   — pytest + pytest-cov (Python HGS)"
	@echo "  make test-coverage    — chạy + sinh báo cáo coverage + auto-mở 3 HTML report"
	@echo "  make test-report      — chỉ mở 3 HTML report đã build (không chạy lại test)"
	@echo "  make test-e2e         — Playwright E2E (cần backend+frontend chạy + seed data)"
	@echo "  make test-e2e-ui      — Playwright UI mode (debug step-by-step)"
	@echo "  make test-e2e-headed  — Playwright với browser hiện ra (xem hành động)"
	@echo "  make test-e2e-report  — mở HTML report của lần E2E gần nhất"
	@echo "  ── Khác ────────────────────────────────────────────────────────"
	@echo "  make api-docs         — in URL Swagger UI (cần backend đang chạy)"
	@echo "  make api-docs-sync    — đồng bộ openapi.json từ backend (CẢNH BÁO ghi đè)"
	@echo "  make docs-deploy      — deploy docs lên GitHub Pages (sau khi mở Student Pack)"
	@echo ""

start: mongo
	@$(NVM) && cd backend && npm run dev > $(LOG_BE) 2>&1 & \
	$(NVM) && cd frontend-web && node_modules/.bin/vite --host 0.0.0.0 > $(LOG_FE) 2>&1 & \
	sleep 5 && \
	echo "" && \
	echo "  ✔ MongoDB   — Docker container" && \
	echo "  ✔ Backend   — http://localhost:5000/api" && \
	echo "  ✔ Frontend  — http://localhost:5173" && \
	echo "  ✔ API Docs  — http://localhost:5000/api-docs" && \
	echo "" && \
	echo "  Docs riêng: make docs-local   (build + serve tại :3000)" && \
	echo "  Xem log:    make logs         |   Dừng: make stop" && \
	echo "" && \
	tail -f $(LOG_BE) $(LOG_FE)

stop:
	@lsof -ti:5000,5173 | xargs -r kill && echo "Đã dừng Backend + Frontend" || echo "Không có process nào đang chạy"

# ─────────────────────────────────────────────────────────────────
#  PRODUCTION (chạy trên server EC2 / VPS qua Docker Compose)
#  - Đọc backend/.env.production (BẮT BUỘC tạo trước khi start)
#  - Port chỉ bind 127.0.0.1 → traffic public đi qua Nginx + HTTPS
#  - QUAN TRỌNG: phải có -f docker-compose.prod.yml, không dùng dev compose
# ─────────────────────────────────────────────────────────────────
COMPOSE_PROD := docker compose -f docker-compose.prod.yml

# Guard: bảo vệ trường hợp deploy.env bị xóa hoặc rỗng.
# Bình thường deploy.env có sẵn trong repo → guard này không kích hoạt.
require-deploy-config:
	@if [ -z "$(DOMAIN)" ] || [ -z "$(EMAIL)" ]; then \
		echo ""; \
		echo "  ✗ deploy.env thiếu DOMAIN hoặc EMAIL."; \
		echo "  Sửa file deploy.env (gồm 2 dòng) rồi chạy lại."; \
		echo "  Hoặc truyền inline: make deploy-prod DOMAIN=... EMAIL=..."; \
		echo ""; \
		exit 1; \
	fi

# ★★ Deploy 1 lệnh duy nhất trên server mới:
#    git clone → cd TMS → make deploy-prod
# Tự đọc DOMAIN + EMAIL từ deploy.env (đã commit cùng repo).
# Bao gồm: tạo .env (auto secrets) → build + start container → cài nginx → cài SSL.
# Không seed DB (an toàn — chạy `make seed-prod` riêng nếu muốn dữ liệu mẫu).
# Idempotent: chạy lại nhiều lần OK; init-prod skip nếu đã có .env, certbot renew nếu cert sắp hết hạn.
deploy-prod: require-deploy-config
	@echo "════════════════════════════════════════════════════════"
	@echo "  ▶  DEPLOY PRODUCTION  →  https://$(DOMAIN)"
	@echo "════════════════════════════════════════════════════════"
	@echo ""
	@echo "  [1/4] Tạo .env.production (auto secrets, không cần điền tay)"
	@$(MAKE) --no-print-directory init-prod
	@echo ""
	@echo "  [2/4] Build + start Docker stack (mongo + redis + optimizer + backend + web + docs)"
	@$(MAKE) --no-print-directory start-prod
	@echo ""
	@echo "  [3/4] Cài Nginx reverse proxy cho 5 subdomain"
	@$(MAKE) --no-print-directory nginx-prod
	@echo ""
	@echo "  [4/4] Cài SSL Let's Encrypt (HTTPS) cho 5 subdomain"
	@$(MAKE) --no-print-directory ssl-prod
	@echo ""
	@echo "════════════════════════════════════════════════════════"
	@echo "  ✔  DEPLOY XONG"
	@echo "════════════════════════════════════════════════════════"
	@echo "  ✔ Web      → https://$(DOMAIN)"
	@echo "  ✔ Track    → https://track.$(DOMAIN)"
	@echo "  ✔ Route    → https://route.$(DOMAIN)"
	@echo "  ✔ Docs     → https://docs.$(DOMAIN)"
	@echo "  ✔ API      → https://$(DOMAIN)/api"
	@echo ""
	@echo "  Tiếp theo:"
	@echo "    make seed-prod        — seed dữ liệu mẫu (chỉ chạy LẦN ĐẦU, KHÔNG chạy lại nếu đã có data thật)"
	@echo "    make logs env=prod    — xem log realtime"
	@echo "    make update-prod      — sau này muốn update code từ git"
	@echo ""

# Setup lần đầu: copy template + auto sinh JWT/REFRESH secret + set FRONTEND_URL/CORS từ DOMAIN.
# Không yêu cầu điền tay gì — SMTP/Gemini để rỗng, backend graceful skip 2 feature đó.
# Idempotent: chạy lại sẽ skip nếu file đã tồn tại.
init-prod: require-deploy-config
	@if [ -f backend/.env.production ]; then \
		echo "✔ backend/.env.production đã tồn tại — bỏ qua. Muốn tạo lại? Xoá tay rồi chạy lại."; \
	else \
		cp backend/.env.production.example backend/.env.production; \
		JWT=$$(openssl rand -hex 32); \
		REFRESH=$$(openssl rand -hex 32); \
		sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$$JWT|" backend/.env.production; \
		if grep -q "^REFRESH_JWT_SECRET" backend/.env.production; then \
			sed -i "s|^REFRESH_JWT_SECRET=.*|REFRESH_JWT_SECRET=$$REFRESH|" backend/.env.production; \
		else \
			echo "REFRESH_JWT_SECRET=$$REFRESH" >> backend/.env.production; \
		fi; \
		sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://$(DOMAIN)|" backend/.env.production; \
		sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=https://$(DOMAIN),https://www.$(DOMAIN),https://route.$(DOMAIN),https://track.$(DOMAIN),https://docs.$(DOMAIN)|" backend/.env.production; \
		echo "✔ Tạo backend/.env.production"; \
		echo "✔ JWT_SECRET + REFRESH_JWT_SECRET ngẫu nhiên 256-bit"; \
		echo "✔ FRONTEND_URL=https://$(DOMAIN)"; \
		echo "✔ CORS_ORIGINS=5 subdomain HTTPS"; \
		echo ""; \
		echo "  Optional (thêm sau nếu muốn — backend đã skip an toàn nếu rỗng):"; \
		echo "  - SMTP_USER/SMTP_PASS  → bật gửi mail xác thực + quên mật khẩu"; \
		echo "  - GEMINI_API_KEY       → bật AI chat assistant"; \
		echo "  - SENTRY_DSN           → bật error tracking"; \
		echo "  Sau khi sửa: make restart-prod"; \
	fi

start-prod:
	@if [ ! -f backend/.env.production ]; then \
		echo "✗ Thiếu file backend/.env.production"; \
		echo "  Chạy: make init-prod   (auto tạo, không cần điền tay)"; \
		echo "  Hoặc:  make deploy-prod (init + start + nginx + SSL — 1 lệnh)"; \
		exit 1; \
	fi
	@$(COMPOSE_PROD) up -d --build
	@echo ""
	@echo "  ✔ Production stack đã start"
	@echo "  ✔ Backend   — http://127.0.0.1:5000/api  (loopback only)"
	@echo "  ✔ Optimizer — http://127.0.0.1:8000      (loopback only)"
	@echo "  ✔ Web       — port 8080 (qua Nginx → https://$(DOMAIN))"
	@echo "  ✔ Docs      — port 8081 (qua Nginx → https://docs.$(DOMAIN))"
	@echo ""
	@echo "  Lần đầu, sau lệnh này còn cần:"
	@echo "    make nginx-prod   (cài reverse proxy, default DOMAIN=$(DOMAIN))"
	@echo "    make ssl-prod     (cài SSL, default EMAIL=$(EMAIL))"
	@echo "  Hoặc gọn 1 lệnh:   make deploy-prod"
	@echo ""
	@echo "  Xem log:  make logs env=prod   |  Dừng: make stop-prod"

stop-prod:
	@$(COMPOSE_PROD) down
	@echo "✔ Đã dừng production stack"

restart-prod:
	@$(COMPOSE_PROD) restart
	@echo "✔ Đã restart production stack"

logs-prod:
	@$(COMPOSE_PROD) logs -f --tail=200

build-prod:
	@$(COMPOSE_PROD) build --no-cache
	@echo "✔ Đã rebuild production images"

prod-status:
	@$(COMPOSE_PROD) ps

seed-prod:
	@$(COMPOSE_PROD) exec backend node src/seed/seed.js
	@echo "✔ Đã seed dữ liệu mẫu vào production DB"

# Update 1 lệnh: git pull → rebuild → restart. Dùng khi đã có code mới trên main.
update-prod:
	@echo "▶ Đang pull code mới ..."
	@git pull
	@echo "▶ Rebuild image ..."
	@$(COMPOSE_PROD) build
	@echo "▶ Restart container đã đổi ..."
	@$(COMPOSE_PROD) up -d
	@echo "✔ Update xong. Xem log: make logs env=prod"

# Rebuild + restart riêng container docs (không động vào backend/frontend đang chạy).
# Dùng khi chỉ sửa Docusaurus mà không muốn down toàn bộ stack.
update-docs:
	@$(COMPOSE_PROD) up -d --no-deps --build docs
	@echo "✔ Docs container đã rebuild"

# Cài nginx reverse proxy trên host. Đọc DOMAIN từ deploy.env (hoặc inline override).
nginx-prod: require-deploy-config
	@if [ ! -d /etc/nginx/sites-available ]; then \
		echo "✗ Nginx chưa cài. Chạy: sudo apt install -y nginx"; \
		exit 1; \
	fi
	@sed 's|__DOMAIN__|$(DOMAIN)|g' scripts/nginx/tms.conf.template | sudo tee /etc/nginx/sites-available/tms > /dev/null
	@sudo ln -sf /etc/nginx/sites-available/tms /etc/nginx/sites-enabled/tms
	@sudo rm -f /etc/nginx/sites-enabled/default
	@sudo nginx -t && sudo systemctl reload nginx
	@echo "✔ Nginx config OK + reload xong"
	@echo "  Test: curl -I http://$(DOMAIN)"
	@echo "  Tiếp theo: make ssl-prod DOMAIN=$(DOMAIN) EMAIL=your-email@gmail.com"

# Cài SSL Let's Encrypt cho 5 subdomain. Đọc DOMAIN + EMAIL từ deploy.env (hoặc inline override).
ssl-prod: require-deploy-config
	@command -v certbot >/dev/null 2>&1 || { \
		echo "▶ Cài certbot ..."; \
		sudo snap install --classic certbot; \
		sudo ln -sf /snap/bin/certbot /usr/bin/certbot; \
	}
	@sudo certbot --nginx \
		-d $(DOMAIN) -d www.$(DOMAIN) -d route.$(DOMAIN) -d track.$(DOMAIN) -d docs.$(DOMAIN) \
		--agree-tos -m $(EMAIL) --non-interactive --redirect
	@echo "✔ SSL OK. Test: https://$(DOMAIN)"
	@echo "  Auto-renew đã cài sẵn (certbot.timer)"

# Debug nhanh: exec vào backend container
exec-backend:
	@$(COMPOSE_PROD) exec backend sh

# Mở mongosh vào DB production
exec-mongo:
	@$(COMPOSE_PROD) exec mongo mongosh road_freight

docs:
	@echo "Đang khởi động User Docs tại http://localhost:3000 ..."
	$(NVM) && cd docs-site && npm start

docs-install:
	$(NVM) && cd docs-site && npm install

docs-build:
	$(NVM) && cd docs-site && npm run build

docs-local:
	@echo "Build production rồi serve tại http://localhost:3000 (search hoạt động đầy đủ)..."
	$(NVM) && cd docs-site && npm run build && npm run serve

docs-deploy:
	@echo "Deploy User Docs lên GitHub Pages (branch gh-pages) ..."
	@echo "Yêu cầu: đã cấu hình GitHub Pages Source = gh-pages branch"
	$(NVM) && cd docs-site && GIT_USER=trinhcongduc112 npm run deploy

docs-stop:
	@lsof -ti:3000 | xargs -r kill 2>/dev/null && echo "Đã dừng User Docs" || echo "User Docs chưa chạy"

api-docs:
	@echo ""
	@echo "  Swagger UI:   http://localhost:5000/api-docs"
	@echo "  OpenAPI JSON: http://localhost:5000/api-docs.json"
	@echo ""
	@echo "  Trong User Docs site: http://localhost:3000/api"
	@echo ""
	@echo "  (Cần backend đang chạy — make backend hoặc make start)"
	@echo ""

api-docs-sync:
	@echo "⚠ Cảnh báo: lệnh này sẽ GHI ĐÈ docs-site/static/openapi.json bằng spec gốc từ backend."
	@echo "   File hiện tại đang có description song ngữ VI/EN — sẽ bị mất nếu sync."
	@echo "   Tiếp tục? (Ctrl+C để hủy, Enter để sync)"
	@read _
	@curl -sS http://localhost:5000/api-docs.json -o docs-site/static/openapi.json
	@echo "OK — $$(wc -c < docs-site/static/openapi.json) bytes"

mongo:
	@docker start road-freight-mongo 2>/dev/null || \
	docker run -d --name road-freight-mongo -p 27017:27017 mongo:7

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
	@if [ "$(env)" = "prod" ]; then \
		$(MAKE) logs-prod; \
	else \
		files=""; \
		[ -f "$(LOG_BE)" ] && files="$$files $(LOG_BE)"; \
		[ -f "$(LOG_FE)" ] && files="$$files $(LOG_FE)"; \
		if [ -n "$$files" ]; then \
			echo "Đang xem log dev:$$files"; \
			tail -n 200 -f $$files; \
		else \
			echo "Chưa có log dev. Chạy 'make start' hoặc 'make dev' trước."; \
			echo "Xem log prod:  make logs env=prod"; \
		fi; \
	fi

check:
	@if [ "$(env)" = "prod" ]; then \
		if [ -f backend/.env.production ]; then \
			echo "── backend/.env.production ──────────────────────"; \
			grep -v '^#\|^$$' backend/.env.production | sed 's/\(PASS\|SECRET\|KEY\)=.*/\1=***/'; \
		else \
			echo "✗ backend/.env.production CHƯA TỒN TẠI"; \
			echo "  Tạo bằng: cp backend/.env.production.example backend/.env.production"; \
		fi; \
	elif [ "$(env)" = "dev" ]; then \
		if [ -f backend/.env ]; then \
			echo "── backend/.env (dev) ───────────────────────────"; \
			grep -v '^#\|^$$' backend/.env | sed 's/\(PASS\|SECRET\|KEY\)=.*/\1=***/'; \
		else \
			echo "✗ backend/.env CHƯA TỒN TẠI (dev sẽ dùng default)"; \
		fi; \
	else \
		echo "Cách dùng: make check env=dev   hoặc   make check env=prod"; \
	fi

seed: mongo
	$(NVM) && cd backend && npm run seed

install:
	$(NVM) && cd backend && npm install
	$(NVM) && cd frontend-web && npm install
	$(NVM) && cd frontend-app && npm install
	$(NVM) && cd docs-site && npm install

# ── Mobile App ──────────────────────────────────────────────────────────────

mobile:
	@echo "  Khởi động Expo — quét QR bằng Expo Go trên điện thoại"
	@echo "  (Đảm bảo điện thoại và máy tính cùng mạng WiFi)"
	@echo ""
	@HOST_IP=$$(hostname -I 2>/dev/null | awk '{print $$1}'); \
	if [ -z "$$HOST_IP" ]; then HOST_IP=$$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($$i=="src") {print $$(i+1); exit}}'); fi; \
	if [ -z "$$HOST_IP" ]; then echo "Không tìm được IP LAN. Chạy thủ công: EXPO_PUBLIC_API_URL=http://<IP_MAY_TINH>:5000/api npx expo start --lan"; exit 1; fi; \
	echo "  API mobile → http://$$HOST_IP:5000/api"; \
	$(NVM) && cd frontend-app && EXPO_PUBLIC_API_URL=http://$$HOST_IP:5000/api npx expo start --lan

mobile-localhost:
	@echo "  Khởi động Expo cho VM/emulator (--localhost mode)"
	@echo "  Sử dụng EXPO_PUBLIC_API_URL để kết nối backend"
	@echo ""
	@HOST_IP=$$(hostname -I 2>/dev/null | awk '{print $$1}'); \
	if [ -z "$$HOST_IP" ]; then HOST_IP=$$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($$i=="src") {print $$(i+1); exit}}'); fi; \
	if [ -z "$$HOST_IP" ]; then echo "Không tìm được IP LAN."; exit 1; fi; \
	echo "  API backend  → http://$$HOST_IP:5000/api"; \
	echo "  Metro server → http://127.0.0.1:8081"; \
	echo ""; \
	$(NVM) && cd frontend-app && EXPO_PUBLIC_API_URL=http://$$HOST_IP:5000/api npx expo start --localhost

mobile-android:
	@echo "  Khởi động Expo trên Android emulator..."
	@adb kill-server >/dev/null 2>&1 || true
	@adb start-server >/dev/null 2>&1
	@adb devices | grep -q "device$$" || (nohup emulator -avd $(ANDROID_AVD) -no-snapshot -no-boot-anim -gpu swiftshader_indirect >/tmp/tms-emulator.log 2>&1 & \
		adb wait-for-device >/dev/null 2>&1; \
		until [ "$$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done)
	@HOST_IP=$$(hostname -I 2>/dev/null | awk '{print $$1}'); \
	if [ -z "$$HOST_IP" ]; then HOST_IP=$$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($$i=="src") {print $$(i+1); exit}}'); fi; \
	if lsof -ti:8081 >/dev/null 2>&1; then \
		echo "  Dùng Expo server đang chạy tại port 8081"; \
		adb shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081" >/dev/null; \
	else \
		echo "  API backend  → http://$$HOST_IP:5000/api"; \
		$(NVM) && cd frontend-app && EXPO_PUBLIC_API_URL=http://$$HOST_IP:5000/api npx expo start --android --localhost; \
	fi

mobile-ios:
	@echo "  Khởi động Expo trên iOS simulator (chỉ dùng trên macOS)..."
	$(NVM) && cd frontend-app && npx expo start --ios

mobile-stop:
	@lsof -ti:8081,19000,19001,19002 | xargs -r kill 2>/dev/null && echo "Đã dừng Expo" || echo "Expo chưa chạy"

# Chụp màn hình emulator (mở sẵn màn cần chụp rồi gọi: make screenshot-mobile NAME=app-login)
screenshot-mobile:
	@if [ -z "$(NAME)" ]; then \
		echo "Cách dùng: make screenshot-mobile NAME=app-login"; \
		echo "Mở emulator + Expo trước (make mobile-android), navigate tới màn rồi chạy."; \
		exit 1; \
	fi
	@./scripts/screenshots/mobile.sh $(NAME)

# ── Build Mobile App (LOCAL — không cần Expo cloud, không cần deploy gì) ──
# APK/IPA xuất ra file ngay trong frontend-app/.
# APK standalone — không cần WiFi chung. Lần đầu mở app, user bấm
# "⚙️ Cấu hình kết nối" để nhập URL backend (giảng viên tự nhập).
#
# Yêu cầu Android: JDK 17, Android SDK đã cài
# Yêu cầu iOS:     macOS + Xcode + cocoapods (Linux không build được iOS)

backup-mongo:
	@echo ""
	@echo "  💾 Backup MongoDB → backups/road_freight-YYYY-MM-DD.tar.gz"
	@echo "  Yêu cầu: container 'tms-mongo' (prod) đang chạy"
	@echo ""
	@bash scripts/backup-mongo.sh

restore-mongo:
	@echo ""
	@echo "  Usage: bash scripts/restore-mongo.sh <backup-file>"
	@ls -lhrt backups/ 2>/dev/null || echo "  (chưa có backup nào — chạy: make backup-mongo)"

benchmark-cache:
	@echo ""
	@echo "  ⏱  Benchmark cache layer — đo throughput trước/sau Redis cache"
	@echo "  Yêu cầu: backend + Redis đang chạy (make start), seed data đã có"
	@echo ""
	@cd backend && node ../scripts/benchmark-cache.js
	@echo ""
	@echo "  ✔ Kết quả lưu tại  benchmark-result.md  (paste vào thesis)"

build-mobile-android:
	@echo ""
	@echo "  📦 Build APK local → frontend-app/road-freight-driver.apk"
	@echo "  ⚙ APK standalone — giảng viên cài xong nhập URL backend trong app"
	@echo "  ⏱  Lần đầu ~5-15 phút (download Gradle), lần sau nhanh hơn"
	@echo ""
	$(NVM) && cd frontend-app && npx eas-cli@latest build --platform android --profile preview --local --non-interactive --output ./road-freight-driver.apk

# Build APK trên cloud Expo (KHÔNG cần Android SDK trên máy) — ~10-15 phút.
# Sau khi build xong, file APK nằm trên server Expo → dùng `make download-apk` để tải về.
# Khuyến nghị dùng `make release-apk` (combo build + download tự động).
build-apk-cloud:
	@echo ""
	@echo "  ☁  Build APK trên cloud Expo (free tier — 30 build/tháng)"
	@echo "  ⏱  Thường 10-15 phút. Không cần Android SDK trên máy."
	@echo "  📡 EXPO_PUBLIC_API_URL từ eas.json: http://47.129.225.75:8080/api"
	@echo ""
	$(NVM) && cd frontend-app && npx eas-cli@latest build --platform android --profile preview --non-interactive

# ⭐ ALL-IN-ONE: build cloud + download APK về frontend-app/road-freight-driver.apk
# Dùng lệnh này khi muốn ra file APK gửi khách bằng 1 lệnh duy nhất.
release-apk: build-apk-cloud download-apk

# Tải file APK từ build cloud Expo gần nhất về máy → frontend-app/road-freight-driver.apk.
# Dùng khi đã build bằng `eas-cli build --platform android` (không có --local) → server EAS giữ artifact,
# lệnh này lấy URL artifact mới nhất rồi curl về để gửi khách / upload Drive.
download-apk:
	@command -v jq >/dev/null 2>&1 || { echo "  ❌ Cần cài jq:  sudo apt install -y jq"; exit 1; }
	@echo ""
	@echo "  🔍 Tìm build APK mới nhất trên Expo cloud..."
	@cd frontend-app && BUILD_JSON=$$($(NVM) && npx eas-cli@latest build:list --platform android --status finished --limit 1 --json --non-interactive 2>/dev/null) && \
		URL=$$(echo "$$BUILD_JSON" | jq -r '.[0].artifacts.buildUrl') && \
		ID=$$(echo "$$BUILD_JSON" | jq -r '.[0].id') && \
		if [ -z "$$URL" ] || [ "$$URL" = "null" ]; then \
			echo "  ❌ Không tìm thấy build APK đã finished. Chạy lại:"; \
			echo "     cd frontend-app && npx eas-cli build --platform android --profile preview"; \
			exit 1; \
		fi && \
		echo "  ✔ Build ID: $$ID" && \
		echo "  ⬇  Tải về: frontend-app/road-freight-driver.apk" && \
		curl -L --progress-bar -o road-freight-driver.apk "$$URL" && \
		SIZE=$$(du -h road-freight-driver.apk | cut -f1) && \
		echo "" && \
		echo "  ✅ Xong! File:  $$(pwd)/road-freight-driver.apk  ($$SIZE)"

build-mobile-ios:
	@if [ "$$(uname)" != "Darwin" ]; then \
		echo ""; \
		echo "  ❌ Build iOS chỉ chạy được trên macOS có Xcode."; \
		echo "  Hệ thống hiện tại: $$(uname). Bỏ qua iOS hoặc dùng máy Mac."; \
		echo ""; \
		exit 1; \
	fi
	@echo ""
	@echo "  📦 Build IPA local → frontend-app/road-freight-driver.ipa"
	@echo "  ⚙ IPA standalone — user nhập URL backend khi mở lần đầu"
	@echo ""
	$(NVM) && cd frontend-app && npx eas-cli@latest build --platform ios --profile preview --local --non-interactive --output ./road-freight-driver.ipa

db-ui:
	@echo "Khởi động Mongo Express tại http://localhost:8082 ..."
	@MONGO_IP=$$(docker inspect road-freight-mongo --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}') && \
	docker rm -f road-freight-db-ui 2>/dev/null; \
	docker run -d --name road-freight-db-ui \
	  -p 8082:8081 \
	  -e ME_CONFIG_MONGODB_URL="mongodb://$$MONGO_IP:27017/" \
	  -e ME_CONFIG_BASICAUTH=false \
	  mongo-express:1 && \
	sleep 3 && echo "  Mở trình duyệt: http://localhost:8082"

db:
	docker exec -it road-freight-mongo mongosh road_freight

clean:
	rm -rf backend/node_modules frontend-web/node_modules frontend-app/node_modules \
	       docs-site/node_modules docs-site/build docs-site/.docusaurus

# ── Test ──────────────────────────────────────────────────────────────────

test: test-backend test-web test-optimizer
	@echo ""
	@echo "  ✔ Tất cả test pass (backend + frontend + optimizer)"
	@echo ""

test-backend:
	@echo "  ▶ Backend (Jest + Supertest + mongodb-memory-server)"
	$(NVM) && cd backend && npm test

test-web:
	@echo "  ▶ Frontend Web (Vitest + React Testing Library)"
	$(NVM) && cd frontend-web && npm test

test-optimizer:
	@echo "  ▶ Optimizer (pytest)"
	@if [ -d optimizer-service/.venv ]; then \
		cd optimizer-service && .venv/bin/pytest tests/ -v; \
	else \
		cd optimizer-service && pytest tests/ -v; \
	fi

test-coverage:
	@echo ""
	@echo "  📊 Backend coverage"
	@echo ""
	$(NVM) && cd backend && npm run test:coverage
	@echo ""
	@echo "  📊 Frontend coverage"
	@echo ""
	$(NVM) && cd frontend-web && npm run test:coverage
	@echo ""
	@echo "  📊 Optimizer coverage"
	@echo ""
	@if [ -d optimizer-service/.venv ]; then \
		cd optimizer-service && .venv/bin/pytest tests/ --cov=hgs --cov=app --cov-report=term --cov-report=html; \
	else \
		cd optimizer-service && pytest tests/ --cov=hgs --cov=app --cov-report=term --cov-report=html; \
	fi
	@echo ""
	@echo "  HTML reports — đang mở trong trình duyệt..."
	@echo "    backend   → backend/coverage/lcov-report/index.html"
	@echo "    frontend  → frontend-web/coverage/index.html"
	@echo "    optimizer → optimizer-service/htmlcov/index.html"
	@echo ""
	@xdg-open backend/coverage/lcov-report/index.html >/dev/null 2>&1 &
	@xdg-open frontend-web/coverage/index.html >/dev/null 2>&1 &
	@xdg-open optimizer-service/htmlcov/index.html >/dev/null 2>&1 &

test-report:
	@echo "  Mở 3 báo cáo coverage đã build (chạy 'make test-coverage' trước nếu chưa có)..."
	@xdg-open backend/coverage/lcov-report/index.html >/dev/null 2>&1 &
	@xdg-open frontend-web/coverage/index.html >/dev/null 2>&1 &
	@xdg-open optimizer-service/htmlcov/index.html >/dev/null 2>&1 &

# ── E2E (Playwright) ─────────────────────────────────────────────────────

test-e2e:
	@echo "  ▶ Playwright E2E — yêu cầu backend + frontend đang chạy"
	@echo "    Nếu chưa chạy: mở terminal khác, gõ 'make start'"
	@echo ""
	$(NVM) && cd e2e && npx playwright test

test-e2e-ui:
	@echo "  ▶ Playwright UI mode (debug interactive)"
	$(NVM) && cd e2e && npx playwright test --ui

test-e2e-headed:
	@echo "  ▶ Playwright headed (xem browser thật chạy)"
	$(NVM) && cd e2e && npx playwright test --headed

test-e2e-report:
	@echo "  Mở Playwright HTML report (có screenshot + video lỗi)"
	$(NVM) && cd e2e && npx playwright show-report

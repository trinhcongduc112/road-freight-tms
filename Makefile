SHELL := /bin/bash
NVM  := export NVM_DIR="$$HOME/.nvm" && . "$$NVM_DIR/nvm.sh" && nvm use 20 --silent

LOG_BE     := /tmp/tms-backend.log
LOG_FE     := /tmp/tms-frontend.log
LOG_MOBILE := /tmp/tms-mobile.log
ANDROID_AVD := Pixel_6

.PHONY: help start stop mongo backend web dev seed logs \
        install clean db-ui db mobile mobile-android mobile-ios mobile-localhost mobile-stop \
        docs docs-install docs-build docs-local docs-deploy docs-stop api-docs api-docs-sync \
        build-mobile-android build-mobile-ios \
        test test-backend test-web test-optimizer test-coverage test-report \
        test-e2e test-e2e-ui test-e2e-headed test-e2e-report

help:
	@echo ""
	@echo "  ── Web (Backend + Frontend) ────────────────────────────────────"
	@echo "  make start            — chạy MongoDB + backend + frontend (kèm tail log)"
	@echo "  make dev              — chạy nền, không mở log"
	@echo "  make stop             — dừng backend + frontend"
	@echo "  make logs             — xem log backend + frontend"
	@echo "  ── Mobile App (Tài xế) ─────────────────────────────────────────"
	@echo "  make mobile           — Expo QR (--lan) cho điện thoại thật cùng WiFi"
	@echo "  make mobile-localhost — Expo cho VM/emulator (--localhost)"
	@echo "  make mobile-android   — Expo + Android emulator"
	@echo "  make mobile-ios       — Expo + iOS simulator (macOS)"
	@echo "  make mobile-stop      — dừng Expo dev server"
	@echo "  ── Build Mobile (APK/IPA file gửi giảng viên) ──────────────────"
	@echo "  make build-mobile-android — build APK local → frontend-app/road-freight-driver.apk"
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
	if [ -n "$$files" ]; then \
		echo "Đang xem log:$$files"; \
		tail -n 200 -f $$files; \
	else \
		echo "Chưa có log. Chạy 'make start' hoặc 'make dev' trước."; \
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

build-mobile-android:
	@echo ""
	@echo "  📦 Build APK local → frontend-app/road-freight-driver.apk"
	@echo "  ⚙ APK standalone — giảng viên cài xong nhập URL backend trong app"
	@echo "  ⏱  Lần đầu ~5-15 phút (download Gradle), lần sau nhanh hơn"
	@echo ""
	$(NVM) && cd frontend-app && npx eas-cli@latest build --platform android --profile preview --local --non-interactive --output ./road-freight-driver.apk

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

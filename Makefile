SHELL := /bin/bash
NVM  := export NVM_DIR="$$HOME/.nvm" && . "$$NVM_DIR/nvm.sh" && nvm use 20 --silent

LOG_BE     := /tmp/tms-backend.log
LOG_FE     := /tmp/tms-frontend.log
LOG_MOBILE := /tmp/tms-mobile.log
ANDROID_AVD := Pixel_6

LOG_SERVICES := backend frontend-web optimizer mongo

.PHONY: help start stop mongo backend web dev seed logs \
        install clean db-ui db mobile mobile-android mobile-ios mobile-localhost mobile-stop

help:
	@echo ""
	@echo "  ── Server ──────────────────────────────────────────────────────"
	@echo "  make start            — khởi động tất cả (MongoDB + backend + frontend)"
	@echo "  make dev              — chạy web nền, không mở log"
	@echo "  make stop             — dừng backend + frontend"
	@echo "  make logs             — xem log backend + frontend"
	@echo "  ── Mobile App (Tài xế) ─────────────────────────────────────────"
	@echo "  make mobile           — chạy app tài xế bằng Expo QR (--lan)"
	@echo "  make mobile-localhost — Expo cho VM/emulator standalone (--localhost)"
	@echo "  make mobile-android   — Expo trực tiếp trên Android emulator"
	@echo "  make mobile-ios       — Expo trực tiếp trên iOS simulator (macOS)"
	@echo "  make mobile-stop      — dừng Expo dev server"
	@echo "  ── DB / Seed ───────────────────────────────────────────────────"
	@echo "  make seed             — reset DB và seed dữ liệu mẫu"
	@echo "  make db-ui            — Mongo Express tại http://localhost:8082"
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
	if [ -n "$$files" ]; then \
		echo "Đang xem log backend + web:$$files"; \
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
	rm -rf backend/node_modules frontend-web/node_modules frontend-app/node_modules

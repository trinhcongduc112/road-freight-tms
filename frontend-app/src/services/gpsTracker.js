/**
 * GPS Tracker — đáp ứng ISO 25010 mục 1.2 (Performance) + 3.2 (Reliability / Fault Tolerance):
 *
 * - Push GPS định kỳ ~30s (Location.watchPositionAsync với timeInterval=30000).
 * - Khi mất mạng → enqueue point vào AsyncStorage (key per trip).
 * - Mỗi tick + mỗi lần resume → flush queue lên server theo batch.
 * - Tracker tự động bind theo tripId; gọi start(tripId) khi chuyến IN_PROGRESS,
 *   gọi stop() khi RETURNING/COMPLETED/CANCELLED.
 *
 * Public API:
 *   import { gpsTracker } from "./gpsTracker";
 *   await gpsTracker.start(tripId);
 *   await gpsTracker.stop();
 *   await gpsTracker.flush();            // ép sync queue ngay
 *   gpsTracker.getQueueSize(tripId)      // số điểm đang chờ (debug)
 */
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { driverApi } from "../api/driver";

const QUEUE_KEY = (tripId) => `gps_queue_${tripId}`;
const ACTIVE_KEY = "gps_active_trip";
const PUSH_INTERVAL_MS = 5_000;       // 5 s — UX realtime cho dispatcher
const DISTANCE_INTERVAL_M = 15;       // ≥15 m mới fire — bỏ điểm nhiễu khi xe đứng yên, tiết kiệm pin
const BATCH_SIZE = 50;                // số điểm gửi mỗi lần flush
const MAX_QUEUE = 5000;               // chống tràn — drop điểm cũ nhất nếu vượt

class GpsTracker {
  constructor() {
    this.tripId = null;
    this.watchSub = null;
    this._flushing = false;
  }

  /**
   * Bật theo dõi cho 1 chuyến cụ thể. Idempotent — nếu đã tracking cùng tripId thì no-op.
   * Nếu đang track tripId khác → stop cái cũ trước.
   */
  async start(tripId) {
    if (!tripId) return;
    const id = String(tripId);
    if (this.tripId === id && this.watchSub) return;
    await this.stop();

    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      console.warn("[gps-tracker] foreground permission denied — bỏ qua tracking");
      return;
    }

    this.tripId = id;
    await AsyncStorage.setItem(ACTIVE_KEY, id);

    try {
      this.watchSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: PUSH_INTERVAL_MS,
          distanceInterval: DISTANCE_INTERVAL_M,
        },
        (loc) => this._onTick(loc).catch((err) =>
          console.warn("[gps-tracker] tick failed:", err?.message ?? err)
        ),
      );
    } catch (err) {
      console.warn("[gps-tracker] watchPositionAsync failed:", err?.message ?? err);
    }
  }

  async stop() {
    try { this.watchSub?.remove?.(); } catch {}
    this.watchSub = null;
    this.tripId = null;
    await AsyncStorage.removeItem(ACTIVE_KEY).catch(() => {});
  }

  /**
   * Resume lúc app khởi động — nếu phiên trước có ACTIVE_KEY thì bật lại tracker.
   * Gọi 1 lần sau khi đăng nhập / app sẵn sàng.
   */
  async resumeIfNeeded() {
    try {
      const id = await AsyncStorage.getItem(ACTIVE_KEY);
      if (id) await this.start(id);
    } catch {}
  }

  async _onTick(loc) {
    if (!this.tripId) return;
    const point = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      speed: typeof loc.coords.speed === "number" ? Math.max(0, loc.coords.speed) : 0,
      capturedAt: new Date(loc.timestamp ?? Date.now()).toISOString(),
    };
    await this._enqueue(this.tripId, point);
    await this.flush(this.tripId);
  }

  async _enqueue(tripId, point) {
    try {
      const key = QUEUE_KEY(tripId);
      const raw = await AsyncStorage.getItem(key);
      const queue = raw ? JSON.parse(raw) : [];
      queue.push(point);
      // Drop điểm cũ nhất nếu vượt MAX_QUEUE (tránh đầy storage)
      const trimmed = queue.length > MAX_QUEUE ? queue.slice(queue.length - MAX_QUEUE) : queue;
      await AsyncStorage.setItem(key, JSON.stringify(trimmed));
    } catch (err) {
      console.warn("[gps-tracker] enqueue failed:", err?.message ?? err);
    }
  }

  /**
   * Đẩy queue lên server theo batch. Có thể được gọi từ tick hoặc từ caller ngoài.
   * Trả về { sent, remaining } để debug.
   */
  async flush(tripId = this.tripId) {
    if (!tripId || this._flushing) return { sent: 0, remaining: 0 };
    this._flushing = true;
    try {
      const key = QUEUE_KEY(tripId);
      const raw = await AsyncStorage.getItem(key);
      const queue = raw ? JSON.parse(raw) : [];
      if (queue.length === 0) return { sent: 0, remaining: 0 };

      const batch = queue.slice(0, BATCH_SIZE);
      try {
        if (batch.length === 1) {
          await driverApi.postGps(tripId, batch[0]);
        } else {
          await driverApi.postGps(tripId, { batch });
        }
      } catch (err) {
        // Mạng yếu / lỗi server — giữ queue, không drop.
        console.warn("[gps-tracker] flush failed (giữ queue):", err?.message ?? err);
        return { sent: 0, remaining: queue.length };
      }

      const remaining = queue.slice(batch.length);
      await AsyncStorage.setItem(key, JSON.stringify(remaining));
      return { sent: batch.length, remaining: remaining.length };
    } finally {
      this._flushing = false;
    }
  }

  async getQueueSize(tripId = this.tripId) {
    if (!tripId) return 0;
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY(tripId));
      return raw ? JSON.parse(raw).length : 0;
    } catch { return 0; }
  }
}

export const gpsTracker = new GpsTracker();

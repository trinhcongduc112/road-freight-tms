/**
 * Quản lý API base URL — cho phép cài đặt URL backend từ trong app.
 * Lưu vào SecureStore để bền qua restart.
 *
 * Mỗi APK build ra không cần biết URL backend; user nhập 1 lần ở màn Login.
 */
import * as SecureStore from "expo-secure-store";

const KEY = "api_base_url_v1";

let cached = null;

/** Đọc URL đã lưu (sync sau khi loadBaseUrl được gọi 1 lần). */
export function getBaseUrl() {
  return cached;
}

/** Tải URL từ SecureStore vào cache. Gọi 1 lần khi app khởi động. */
export async function loadBaseUrl() {
  try {
    cached = await SecureStore.getItemAsync(KEY);
  } catch {
    cached = null;
  }
  return cached;
}

/** Lưu URL mới + cập nhật cache. Trả lỗi nếu URL không hợp lệ.
 *  Auto-append `/api` nếu user nhập thiếu (vd: "https://ductms.id.vn" → "https://ductms.id.vn/api").
 *  Backend mount router tại /api → quên suffix này sẽ trả 405/404. */
export async function setBaseUrl(url) {
  let trimmed = String(url ?? "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s]+/.test(trimmed)) {
    throw new Error("URL phải bắt đầu bằng http:// hoặc https://");
  }
  if (!/\/api(\/.*)?$/.test(trimmed)) {
    trimmed += "/api";
  }
  await SecureStore.setItemAsync(KEY, trimmed);
  cached = trimmed;
  return trimmed;
}

/** Xóa URL — quay về fallback mặc định. */
export async function clearBaseUrl() {
  await SecureStore.deleteItemAsync(KEY);
  cached = null;
}

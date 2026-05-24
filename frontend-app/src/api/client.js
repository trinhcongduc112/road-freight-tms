import axios from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { useAuthStore } from "../store/authStore";
import { getBaseUrl } from "./baseUrlStore";

/* Xác định API base URL.
   Thứ tự ưu tiên:
     1. URL user nhập trong app (SecureStore) — chuẩn cho APK release
     2. EXPO_PUBLIC_API_URL (env) — set khi build hoặc dev
     3. Metro bundler host khi chạy Expo Go
     4. Fallback: 10.0.2.2 (Android emulator), localhost (iOS sim) */
function resolveBaseURL() {
  try {
    const stored = getBaseUrl();
    if (stored) {
      console.log("[apiClient] Using stored URL =", stored);
      return stored;
    }

    if (process.env.EXPO_PUBLIC_API_URL) {
      return process.env.EXPO_PUBLIC_API_URL;
    }

    const hostUri =
      Constants?.expoConfig?.hostUri ||
      Constants?.expoGoConfig?.hostUri ||
      Constants?.manifest2?.extra?.expoClient?.hostUri ||
      Constants?.manifest?.debuggerHost ||
      "";
    const metroIp = String(hostUri).split(":")[0];

    if (metroIp && metroIp !== "localhost" && metroIp !== "127.0.0.1") {
      return `http://${metroIp}:5000/api`;
    }

    if (Platform.OS === "android") return "http://10.0.2.2:5000/api";
    return "http://localhost:5000/api";
  } catch {
    return "http://localhost:5000/api";
  }
}

/* baseURL được resolve TRƯỚC mỗi request thông qua interceptor — vì sau khi
   user nhập URL mới trong Settings, ta cần update mà không cần khởi động lại app. */
export const apiClient = axios.create({ timeout: 15000 });

apiClient.interceptors.request.use((config) => {
  // Resolve baseURL per request — cho phép user đổi URL backend từ Settings
  // mà không cần khởi động lại app.
  config.baseURL = resolveBaseURL();
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  }
);

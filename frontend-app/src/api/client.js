import axios from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { useAuthStore } from "../store/authStore";

/* Tự nhận diện IP máy chủ Metro để app tự động tìm backend trên cùng LAN.
   Thứ tự ưu tiên:
     1. EXPO_PUBLIC_API_URL (env) — chuẩn nhất khi build release
     2. Metro bundler host (Constants.expoConfig.hostUri) khi chạy `expo start`
        → backend giả định cùng máy + port 5000
     3. Fallback: 10.0.2.2 cho Android emulator, localhost cho iOS sim. */
function resolveBaseURL() {
  try {
    if (process.env.EXPO_PUBLIC_API_URL) {
      console.log("[apiClient] Using EXPO_PUBLIC_API_URL =", process.env.EXPO_PUBLIC_API_URL);
      return process.env.EXPO_PUBLIC_API_URL;
    }

    const hostUri =
      Constants?.expoConfig?.hostUri ||
      Constants?.expoGoConfig?.hostUri ||
      Constants?.manifest2?.extra?.expoClient?.hostUri ||
      Constants?.manifest?.debuggerHost ||
      "";
    const metroIp = String(hostUri).split(":")[0];

    console.log("[apiClient] hostUri =", hostUri, "| metroIp =", metroIp);

    if (metroIp && metroIp !== "localhost" && metroIp !== "127.0.0.1") {
      const url = `http://${metroIp}:5000/api`;
      console.log("[apiClient] Resolved from Metro IP =", url);
      return url;
    }

    if (Platform.OS === "android") {
      console.log("[apiClient] Using Android emulator default = http://10.0.2.2:5000/api");
      return "http://10.0.2.2:5000/api";
    }

    console.log("[apiClient] Using localhost = http://localhost:5000/api");
    return "http://localhost:5000/api";
  } catch (err) {
    console.error("[apiClient] Error resolving base URL:", err);
    return "http://localhost:5000/api";
  }
}

const BASE = resolveBaseURL();
// eslint-disable-next-line no-console
console.log("[apiClient] baseURL =", BASE);

export const apiClient = axios.create({ baseURL: BASE, timeout: 15000 });

apiClient.interceptors.request.use((config) => {
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

import axios from "axios";
import { Platform } from "react-native";
import { useAuthStore } from "../store/authStore";

// Thiết bị thật (Android/iOS) dùng IP LAN của máy tính
// Android emulator dùng 10.0.2.2
const LAN_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.68:5000/api";
const BASE = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === "android" ? "http://10.0.2.2:5000/api" : LAN_BASE);

export const apiClient = axios.create({ baseURL: BASE, timeout: 15000 });

// Tự động gắn token vào mọi request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Nếu 401 → logout
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  }
);

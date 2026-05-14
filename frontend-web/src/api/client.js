import axios from "axios";
import { useAuthStore } from "../store/authStore";

const baseURL = import.meta.env.VITE_API_URL ?? "/api";

export const apiClient = axios.create({
  baseURL,
  timeout: 15000
});

// ── Request interceptor: gắn Access Token vào mọi request ──
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: auto-refresh khi Access Token hết hạn ──
//
// Học từ Abivin: khi nhận 401, tự động gọi POST /auth/refresh
// với refreshToken → lấy access token mới → retry request gốc.
// Nếu refresh cũng fail → logout về trang login.

let isRefreshing = false;
let pendingQueue = [];    // queue các request đang chờ refresh xong

function processQueue(error, token = null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // Chỉ xử lý 401 cho request đã authenticate. Bỏ qua các endpoint public
    // (login/register/refresh/forgot/reset) — 401 ở các endpoint này là lỗi
    // credentials thật sự, không phải session hết hạn.
    const url = originalRequest.url || "";
    const isPublicAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/forgot-password") ||
      url.includes("/auth/reset-password") ||
      url.includes("/auth/verify-email") ||
      url.includes("/auth/accept-invitation") ||
      url.includes("/support/reply-context") ||
      url.includes("/support/reply");

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isPublicAuthEndpoint
    ) {
      const refreshToken = useAuthStore.getState().refreshToken;

      // Không có refresh token → logout ngay
      if (!refreshToken) {
        useAuthStore.getState().logout();
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.location.replace("/login");
        }
        return Promise.reject(new Error("Session expired. Please login again."));
      }

      // Đang refresh rồi → queue request lại
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      // Bắt đầu refresh
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const raw = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
        const { token: newToken, refreshToken: newRefresh } = raw.data?.data ?? {};

        // Cập nhật store với token mới
        useAuthStore.getState().setSession({
          token:        newToken,
          refreshToken: newRefresh,
          user:         useAuthStore.getState().user,
          role:         useAuthStore.getState().role
        });

        // Thông báo cho các request đang chờ
        processQueue(null, newToken);

        // Retry request gốc với token mới
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        useAuthStore.getState().logout();
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.location.replace("/login");
        }
        return Promise.reject(new Error("Session expired. Please login again."));
      } finally {
        isRefreshing = false;
      }
    }

    // Các lỗi khác: forward message
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Network error";
    return Promise.reject(new Error(message));
  }
);

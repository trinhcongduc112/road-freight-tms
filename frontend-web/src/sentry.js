/* Sentry browser error tracking — optional, kích hoạt qua VITE_SENTRY_DSN.
 * Khi rỗng (dev local) → no-op, frontend chạy bình thường.
 *
 * Lấy DSN: https://sentry.io → Create Project (React) → DSN
 * Cùng project Sentry với backend hay tách project tuỳ tổ chức.
 */
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Bỏ qua lỗi network user-side (CORS, offline) — chỉ track lỗi code thật
    ignoreErrors: ["Network Error", "ResizeObserver loop"],
    tracesSampleRate: 0.1,           // 10% transaction để không vượt free tier
    replaysSessionSampleRate: 0,     // KHÔNG record session (tiết kiệm quota + privacy)
    replaysOnErrorSampleRate: 0.1    // Record 10% session có lỗi để debug
  });
}

// Re-export để các component import "@/sentry" nếu cần manual capture
export { Sentry };

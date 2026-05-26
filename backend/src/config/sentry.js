/* Sentry error tracking — optional, chỉ kích hoạt khi có SENTRY_DSN trong env.
 * Nếu SENTRY_DSN rỗng (dev local hoặc chưa setup) → no-op, backend chạy bình thường.
 *
 * Lấy DSN: https://sentry.io → Create Project (Node.js) → Settings → Client Keys (DSN)
 * Free tier: 5K errors/month — đủ cho đồ án + demo.
 */
import * as Sentry from "@sentry/node";
import { env } from "./env.js";

let initialized = false;

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: env.nodeEnv,
    // Sample 10% transaction trong prod để không vượt free tier.
    tracesSampleRate: env.nodeEnv === "production" ? 0.1 : 1.0,
    // Bỏ qua lỗi user-input (4xx) — chỉ track lỗi server (5xx) và exception
    beforeSend(event, hint) {
      const err = hint.originalException;
      if (err?.status && err.status >= 400 && err.status < 500) return null;
      return event;
    }
  });
  initialized = true;
}

/* Express error handler dành cho Sentry — đặt TRƯỚC errorHandler chính. */
export function sentryErrorHandler() {
  if (!initialized) return (_err, _req, _res, next) => next(_err);
  return Sentry.expressErrorHandler();
}

/* Manual capture cho try/catch trong service layer hoặc background job. */
export function captureException(err, context = {}) {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
    Sentry.captureException(err);
  });
}

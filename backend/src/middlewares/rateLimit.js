import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV !== "production";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút." }
});

export const strictAuthRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 100 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Quá nhiều yêu cầu nhạy cảm. Vui lòng thử lại sau 1 giờ." }
});

// Public contact form — 5 lần / 10 phút / IP để chống spam
export const contactRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: isDev ? 50 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút." }
});

// Public tracking — 60 lần / 1 phút / IP (đủ cho khách F5 nhưng chặn bot scrape)
export const trackingRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 300 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Quá nhiều yêu cầu tra cứu. Vui lòng đợi 1 phút." }
});

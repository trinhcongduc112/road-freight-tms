import "dotenv/config";

function required(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function requiredSecret(key, fallback) {
  const value = required(key, fallback);
  if (process.env.NODE_ENV === "production") {
    if (!process.env[key]) throw new Error(`Missing required production secret: ${key}`);
    if (String(value).includes("dev-") || String(value).length < 32) {
      throw new Error(`Weak production secret: ${key}`);
    }
  }
  return value;
}

function bool(key, fallback = false) {
  const v = process.env[key];
  if (v === undefined || v === null || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  // Bind interface — dev mặc định 0.0.0.0 (cho phép truy cập từ LAN/mobile),
  // prod cũng 0.0.0.0 (nginx container proxy vào). Override qua HOST env nếu cần.
  host: process.env.HOST ?? "0.0.0.0",
  optimizerServiceUrl: process.env.OPTIMIZER_SERVICE_URL ?? "http://localhost:8000",
  optimizerTimeoutMs: Number(process.env.OPTIMIZER_TIMEOUT_MS ?? 60000),
  mongoUri: required("MONGODB_URI", "mongodb://localhost:27017/road_freight"),
  // Redis cache + distributed rate-limit. Để rỗng → fallback chạy không cache (vẫn work, throughput thấp hơn).
  redisUrl: process.env.REDIS_URL ?? "",
  jwtSecret: requiredSecret("JWT_SECRET", "dev-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",       // dev: 7d | production: set "15m" qua env
  refreshJwtSecret: requiredSecret("REFRESH_JWT_SECRET", "dev-refresh-secret-change-me"),
  refreshJwtExpiresIn: process.env.REFRESH_JWT_EXPIRES_IN ?? "30d",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  /* CORS allowed origins — CSV. Hỗ trợ nhiều domain (production có nhiều subdomain
     trỏ về cùng frontend). Nếu để rỗng, fallback dùng FRONTEND_URL.
     Vd: "https://ductms.id.vn,https://www.ductms.id.vn,https://track.ductms.id.vn" */
  corsOrigins: (process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? "http://localhost:5173")
    .split(",").map((s) => s.trim()).filter(Boolean),
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",

  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: bool("SMTP_SECURE", false),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "Road Freight TMS <no-reply@road-freight.io>",
  supportEmail: process.env.SUPPORT_EMAIL ?? process.env.SMTP_USER ?? "support@road-freight.io",

  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // gemini-2.5-flash: function calling tốt hơn nhiều so với gemini-2.5-flash-lite,
  // vẫn nằm trong free tier. Tránh dùng `-lite` cho AI Agent vì nó hay skip tool call.
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash"
};

export const isProduction = env.nodeEnv === "production";

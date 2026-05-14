import "dotenv/config";

function required(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required env var: ${key}`);
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
  optimizerServiceUrl: process.env.OPTIMIZER_SERVICE_URL ?? "http://localhost:8000",
  optimizerTimeoutMs: Number(process.env.OPTIMIZER_TIMEOUT_MS ?? 60000),
  mongoUri: required("MONGODB_URI", "mongodb://localhost:27017/road_freight"),
  jwtSecret: required("JWT_SECRET", "dev-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",       // dev: 7d | production: set "15m" qua env
  refreshJwtSecret: required("REFRESH_JWT_SECRET", "dev-refresh-secret-change-me"),
  refreshJwtExpiresIn: process.env.REFRESH_JWT_EXPIRES_IN ?? "30d",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",

  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: bool("SMTP_SECURE", false),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "Road Freight TMS <no-reply@road-freight.io>",
  supportEmail: process.env.SUPPORT_EMAIL ?? process.env.SMTP_USER ?? "support@road-freight.io",

  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash"
};

export const isProduction = env.nodeEnv === "production";

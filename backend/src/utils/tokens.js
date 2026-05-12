import crypto from "node:crypto";

/**
 * Sinh secure random token (URL-safe). Trả về cả raw (gửi qua email)
 * và hash (lưu DB) để chống lộ token nếu DB bị leak.
 */
export function generateToken(byteLength = 32) {
  const raw = crypto.randomBytes(byteLength).toString("base64url");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function expiresIn(ms) {
  return new Date(Date.now() + ms);
}

export const TOKEN_TTL = Object.freeze({
  EMAIL_VERIFY: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
  INVITATION: 7 * 24 * 60 * 60 * 1000
});

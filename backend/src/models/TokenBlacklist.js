import mongoose from "mongoose";

/**
 * TokenBlacklist — lưu các JWT đã bị logout hoặc bị thu hồi.
 *
 * Học từ Abivin: họ dùng Redis SET với TTL. Mình không có Redis nên dùng
 * MongoDB + TTL index — Mongoose tự xóa document hết hạn (tương đương Redis EXPIRE).
 *
 * Flow:
 *   logout  → thêm jti vào blacklist với expiry = thời hạn còn lại của JWT
 *   request → middleware check jti trước khi verify JWT signature
 */
const tokenBlacklistSchema = new mongoose.Schema(
  {
    // jti (JWT ID) — unique per token, được set lúc signToken()
    jti:       { type: String, required: true, unique: true, index: true },
    // type: "access" hoặc "refresh"
    type:      { type: String, enum: ["access", "refresh"], default: "access" },
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // expireAt: MongoDB TTL index tự xóa document sau thời điểm này
    expireAt:  { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: false, _id: false }
);

// Compound unique: (jti, type) để an toàn hơn
tokenBlacklistSchema.index({ jti: 1, type: 1 }, { unique: true });

export const TokenBlacklist = mongoose.model("TokenBlacklist", tokenBlacklistSchema);

/**
 * Thêm token vào blacklist.
 * @param {string} jti
 * @param {"access"|"refresh"} type
 * @param {Date}   expireAt - Thời điểm token JWT thật sự hết hạn
 * @param {string} userId
 */
export async function blacklistToken(jti, type = "access", expireAt, userId) {
  try {
    await TokenBlacklist.create({ jti, type, expireAt, userId });
  } catch (err) {
    // Ignore duplicate key — token có thể đã bị blacklist rồi
    if (err.code !== 11000) throw err;
  }
}

/**
 * Kiểm tra token có bị blacklist không.
 */
export async function isBlacklisted(jti, type = "access") {
  return TokenBlacklist.exists({ jti, type });
}

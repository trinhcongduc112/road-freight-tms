import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User, UserStatus } from "../models/User.js";
import { RoleGroup } from "../models/RoleGroup.js";
import { ApiError } from "../utils/apiError.js";
import { blacklistToken, isBlacklisted } from "../models/TokenBlacklist.js";

// ─────────────────────────────────────────────────────────────
//  Token signing
// ─────────────────────────────────────────────────────────────

/**
 * Tạo Access Token (ngắn hạn).
 * Học từ Abivin: mỗi token có `jti` (JWT ID) duy nhất
 * để có thể đưa vào blacklist khi logout.
 */
export function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.Email,
      isSuperAdmin: user.IsSuperAdmin,
      jti: crypto.randomUUID()     // ← Abivin pattern: mỗi token có ID riêng
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

/**
 * Tạo Refresh Token (dài hạn, 30 ngày).
 * Học từ Abivin: dùng secret riêng, payload tối giản.
 */
export function signRefreshToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      jti: crypto.randomUUID()
    },
    env.refreshJwtSecret,
    { expiresIn: env.refreshJwtExpiresIn }
  );
}

/**
 * Verify Refresh Token, trả về payload nếu hợp lệ.
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, env.refreshJwtSecret);
}

// ─────────────────────────────────────────────────────────────
//  Helper: parse JWT exp → Date
// ─────────────────────────────────────────────────────────────
function jwtExpToDate(exp) {
  return exp ? new Date(exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

// ─────────────────────────────────────────────────────────────
//  Middleware: authenticate
// ─────────────────────────────────────────────────────────────

/**
 * Verifies Access JWT, kiểm tra blacklist, loads user + role.
 *
 * Học từ Abivin: check blacklist TRƯỚC khi verify signature
 * → đảm bảo logout tức thì dù token chưa hết hạn.
 *
 * req.user = User document (without PasswordHash)
 * req.role = RoleGroup document or null
 * req.jwtPayload = decoded payload (để logout dùng jti)
 */
export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new ApiError(401, "Missing authentication token");

    // 1. Decode không verify trước để lấy jti check blacklist
    //    (tránh tốn CPU verify signature của token đã logout)
    let rawPayload;
    try {
      rawPayload = jwt.decode(token);
    } catch {
      throw new ApiError(401, "Malformed token");
    }

    // 2. Check blacklist (Abivin: Redis GET "logout_<token>")
    if (rawPayload?.jti) {
      const blocked = await isBlacklisted(rawPayload.jti, "access");
      if (blocked) throw new ApiError(401, "Token has been revoked. Please login again.");
    }

    // 3. Verify signature + expiry
    const payload = jwt.verify(token, env.jwtSecret);

    // 4. Load user
    const user = await User.findById(payload.sub);
    if (!user || !user.IsActive)              throw new ApiError(401, "Invalid or inactive user");
    if (user.Status === UserStatus.LOCKED)    throw new ApiError(403, "Account is locked");
    if (user.Status === UserStatus.PENDING_VERIFY) throw new ApiError(403, "Email not verified");
    if (user.Status === UserStatus.PENDING_INVITE) throw new ApiError(403, "Invitation not accepted yet");

    req.user       = user;
    req.role       = user.RoleGroupID ? await RoleGroup.findById(user.RoleGroupID) : null;
    req.jwtPayload = payload;   // expose jti cho logout handler
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return next(new ApiError(401, "Invalid or expired token"));
    }
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
//  Export blacklistToken để authController dùng
// ─────────────────────────────────────────────────────────────
export { blacklistToken };

/**
 * Domain rate limiter cho contact form.
 * - Rate limit theo email domain (chặn 1 domain spam nhiều)
 * - Dùng Redis nếu có, fallback in-memory Map
 * 
 * Logic:
 *   - 1 domain = tối đa 3 contact / giờ
 *   - Nếu 1 domain vượt quá → reject tất cả email từ domain đó
 */

import { getRedis } from "./cache.js";
import { getEmailDomain } from "./disposableDomains.js";

// In-memory fallback khi không có Redis (chỉ dùng cho dev/single instance)
const inMemoryDomainLimit = new Map(); // domain → { count, resetAt }

/**
 * Check và tăng counter cho 1 domain.
 * @param {string} domain
 * @returns {{ allowed: boolean, remaining: number, resetIn: number }}
 */
export async function checkDomainRateLimit(domain) {
  if (!domain) return { allowed: true, remaining: 3, resetIn: 0 };

  const MAX_PER_DOMAIN = 3;       // 3 contacts
  const WINDOW_MS = 60 * 60 * 1000; // 1 giờ

  const redis = getRedis();

  if (redis && redis.status === "ready") {
    // Redis path: dùng INCR + EXPIRE
    const key = `rl:domain:${domain}`;
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, WINDOW_MS);
      }
      const ttl = await redis.pttl(key);
      const remaining = Math.max(0, MAX_PER_DOMAIN - count);
      return {
        allowed: count <= MAX_PER_DOMAIN,
        remaining,
        resetIn: ttl > 0 ? Math.ceil(ttl / 1000) : WINDOW_MS / 1000,
      };
    } catch (err) {
      // Redis lỗi → fallback in-memory
      console.warn("[domain-ratelimit] Redis failed, falling back:", err.message);
    }
  }

  // Fallback in-memory
  const now = Date.now();
  const record = inMemoryDomainLimit.get(domain);

  if (!record || now > record.resetAt) {
    inMemoryDomainLimit.set(domain, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_PER_DOMAIN - 1, resetIn: WINDOW_MS / 1000 };
  }

  record.count++;
  const remaining = Math.max(0, MAX_PER_DOMAIN - record.count);
  return {
    allowed: record.count <= MAX_PER_DOMAIN,
    remaining,
    resetIn: Math.ceil((record.resetAt - now) / 1000),
  };
}

/**
 * Reset rate limit cho 1 domain (admin function).
 * @param {string} domain
 */
export async function resetDomainRateLimit(domain) {
  if (!domain) return;
  const redis = getRedis();
  if (redis && redis.status === "ready") {
    await redis.del(`rl:domain:${domain}`);
  }
  inMemoryDomainLimit.delete(domain);
}

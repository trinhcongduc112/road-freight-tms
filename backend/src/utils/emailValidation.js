/**
 * Chặn email spam/fuzz/disposable trước khi tạo account + gửi mail.
 * Dùng cho register / resend-verification (và có thể forgot-password).
 */

/** Domain không nhận mail / dùng cho test-RFC / fuzz phổ biến */
const BLOCKED_DOMAINS = new Set([
  // RFC reserved
  "example.com",
  "example.org",
  "example.net",
  "example.edu",
  "invalid",
  "localhost",
  "test",
  "local",
  // Test domains hay bị scanner dùng
  "test.com",
  "test.org",
  "test.net",
  "test.local",
  "email.com",
  "mail.com", // đôi khi bot dùng; bỏ comment nếu bạn cần cho user thật
  // Disposable / temp mail phổ biến
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwaway.email",
  "yopmail.com",
  "sharklasers.com",
  "trashmail.com",
  "fakeinbox.com",
  "getnada.com",
  "maildrop.cc",
  "dispostable.com",
  "mailnesia.com"
]);

/**
 * Local-part (trước @) mang dấu hiệu pentest/fuzz.
 * Chỉ chặn pattern rõ ràng — tránh false positive với user thật.
 */
const SUSPICIOUS_LOCAL_RE =
  /^(audit[_\-.]?\d*[_\-.]?test$|sa[_\-.]?\d+|pt[_\-.]?\d+|security[_\-.]?audit|pentest|bypass|fuzz|fuzzi|fuzzadmin|fuzzsuper|fuzzuser|admin_?bypass|scan_|sa_\d{8,}|test_?scan|fuzz(er|ing)?)/i;

const SUSPICIOUS_TEXT_RE = /(<\s*script|onerror\s*=|onload\s*=|javascript:|data:text\/html|<\s*img|<\s*svg|\balert\s*\()/i;

const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {unknown} raw
 * @returns {{ ok: true, email: string } | { ok: false, reason: string }}
 */
export function isSuspiciousSignupText(raw) {
  return typeof raw === "string" && SUSPICIOUS_TEXT_RE.test(raw);
}

export function validateSignupEmail(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, reason: "Email là bắt buộc" };
  }

  const email = raw.trim().toLowerCase();
  if (!EMAIL_FORMAT_RE.test(email) || email.length > 254) {
    return { ok: false, reason: "Email không đúng định dạng" };
  }

  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (!local || !domain || domain.includes("..")) {
    return { ok: false, reason: "Email không đúng định dạng" };
  }

  // Chặn domain + subdomain (vd: foo.example.com, mail.test.com)
  const parts = domain.split(".");
  for (let i = 0; i < parts.length; i++) {
    const suffix = parts.slice(i).join(".");
    if (BLOCKED_DOMAINS.has(suffix)) {
      return { ok: false, reason: "Email domain không được hỗ trợ" };
    }
  }

  // TLD rác / quá ngắn bất thường (không chặn .vn .com .io …)
  const tld = parts[parts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-z0-9-]+$/i.test(tld)) {
    return { ok: false, reason: "Email domain không hợp lệ" };
  }

  if (SUSPICIOUS_LOCAL_RE.test(local)) {
    return { ok: false, reason: "Email không hợp lệ" };
  }

  return { ok: true, email };
}

/** Export để test / mở rộng blocklist runtime nếu cần */
export function isDomainBlocked(domain) {
  const d = String(domain || "").toLowerCase();
  const parts = d.split(".");
  for (let i = 0; i < parts.length; i++) {
    if (BLOCKED_DOMAINS.has(parts.slice(i).join("."))) return true;
  }
  return false;
}

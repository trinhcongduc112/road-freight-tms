// Helpers cho subdomain tracking. Mục tiêu:
//   - track.<domain>          → mở thẳng search form (không cần gõ /track)
//   - track.<domain>/<code>   → auto load đơn (path ngắn để gửi khách)
//   - <domain>/track[/<code>] → vẫn work cho backward compat + link cũ

const KNOWN_PREFIXES = ["www", "route", "track", "docs"];

export function isTrackSubdomain() {
  if (typeof window === "undefined") return false;
  return window.location.hostname.startsWith("track.");
}

// Khi sales đứng ở route.* / apex / www.* mà copy share link, link phải dẫn về track.*
// để khách không bị redirect về login. Dev (localhost/IP LAN): không có subdomain → giữ origin.
export function buildTrackingOrigin() {
  const { protocol, hostname, origin } = window.location;
  if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return origin;
  }
  const parts = hostname.split(".");
  if (parts.length >= 3 && KNOWN_PREFIXES.includes(parts[0])) {
    parts[0] = "track";
  } else {
    parts.unshift("track");
  }
  return `${protocol}//${parts.join(".")}`;
}

// Link share gửi khách. Trên track.* dùng path ngắn /<code>; còn lại dùng /track/<code>.
export function buildShareTrackingUrl(orderCode) {
  const origin = buildTrackingOrigin();
  // Origin trỏ về track.* → path ngắn. Dev localhost giữ origin → vẫn /track/<code>.
  const isProdTrack = origin.includes("//track.");
  const path = isProdTrack ? `/${orderCode}` : `/track/${orderCode}`;
  return `${origin}${path}`;
}

// Navigate path nội bộ (relative). Trên track.* → /<code>, else → /track/<code>.
export function buildTrackingNavigatePath(orderCode) {
  return isTrackSubdomain() ? `/${orderCode}` : `/track/${orderCode}`;
}

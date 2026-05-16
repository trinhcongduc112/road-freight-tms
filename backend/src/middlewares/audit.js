/**
 * Audit middleware — ghi mọi thao tác mutation (POST/PUT/PATCH/DELETE)
 * vào collection AuditLog.
 *
 * Đáp ứng: ISO 27001 control A.12.4 (Logging), ISO 25010 Reliability + Security.
 *
 * Fire-and-forget: không await, không block response. Lỗi ghi log chỉ logger.warn.
 */
import { AuditLog } from "../models/AuditLog.js";
import { logger } from "../utils/logger.js";

const AUDIT_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * GET endpoint nhạy cảm cần audit — chủ yếu là endpoint tạo báo cáo / lấy data export.
 * Khi user xuất Excel ở UI, frontend gọi GET đến những endpoint này → audit "EXPORT".
 */
const AUDIT_GET_PATHS = [
  /^\/api\/reports\//,             // /api/reports/summary
  /^\/api\/payroll\//,             // /api/payroll/drivers — bảng lương
  /^\/api\/audit-logs(\?|$|\/)/,   // xem audit log cũng cần audit (meta)
  /^\/api\/maintenance\/alerts/
];

const SKIP_PATHS = [
  /^\/api\/auth\/refresh$/,
  /^\/api\/system\//,
  /^\/api\/agent\/execute$/,    // command chứa text user nhập — đã có log riêng
  /^\/api\/support\/sessions\/[^/]+\/messages$/,
  /^\/api\/driver\/.*\/gps/i,    // GPS push 5s — không cần audit
  /^\/api\/driver\/.*\/location/i
];

function resourceFromPath(pathStr) {
  // /api/orders/abc123 -> "Order"
  // /api/route-plans -> "RoutePlan"
  // /api/master-data/customers -> "MasterData.Customer"
  const m = pathStr.match(/^\/api\/([^/]+)(?:\/([^/?]+))?/);
  if (!m) return "Unknown";
  const top = m[1];
  const sub = m[2];
  const map = {
    auth: "Auth",
    orders: "Order",
    "route-plans": "RoutePlan",
    trips: "Trip",
    users: "User",
    "role-groups": "RoleGroup",
    "master-data": sub ? `MasterData.${sub}` : "MasterData",
    organizations: "Organization",
    reports: "Report",
    driver: "Driver",
    support: "Support"
  };
  return map[top] ?? top;
}

function methodToAction(method, path) {
  if (path.endsWith("/login")) return "LOGIN";
  if (path.endsWith("/logout")) return "LOGOUT";
  if (path.includes("/export")) return "EXPORT";
  if (path.includes("/import")) return "IMPORT";
  // GET báo cáo / payroll / audit-logs → coi như EXPORT (user đang lấy data ra)
  if (method === "GET") return "EXPORT";
  switch (method) {
    case "POST":
      return "CREATE";
    case "PUT":
    case "PATCH":
      return "UPDATE";
    case "DELETE":
      return "DELETE";
    default:
      return "OTHER";
  }
}

function summarizePayload(body) {
  if (!body || typeof body !== "object") return null;
  // Loại bỏ trường nhạy cảm và data lớn
  const omit = ["Password", "password", "OldPassword", "NewPassword", "Token", "RefreshToken", "PodImages", "ConfirmPhotos", "LoadingPhotos", "StartPhotos", "FinishPhotos"];
  const result = {};
  for (const [k, v] of Object.entries(body)) {
    if (omit.includes(k)) continue;
    if (typeof v === "string" && v.length > 200) {
      result[k] = v.slice(0, 200) + "...";
    } else if (Array.isArray(v) && v.length > 20) {
      result[k] = `[Array(${v.length})]`;
    } else {
      result[k] = v;
    }
  }
  return result;
}

export function auditLogger() {
  return (req, res, next) => {
    const fullPath = req.originalUrl.split("?")[0];

    // Audit nếu là mutation HOẶC GET trùng pattern báo cáo/export
    const isMutation = AUDIT_METHODS.has(req.method);
    const isAuditableGet = req.method === "GET" && AUDIT_GET_PATHS.some((re) => re.test(req.originalUrl));
    if (!isMutation && !isAuditableGet) return next();

    if (SKIP_PATHS.some((re) => re.test(fullPath))) return next();

    const start = process.hrtime.bigint();
    res.on("finish", () => {
      // Chỉ log thao tác thành công hoặc lỗi validation/forbidden — không log 5xx (đã có errorHandler)
      if (res.statusCode >= 500) return;

      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const entry = {
        OrganizationID: req.role?.OrganizationID ?? req.user?.OrganizationIDs?.[0] ?? null,
        UserID: req.user?._id ?? null,
        UserEmail: req.user?.Email ?? "",
        UserName: req.user?.FullName ?? "",
        Action: methodToAction(req.method, fullPath),
        Resource: resourceFromPath(fullPath),
        ResourceID: req.params?.id || req.params?.code || "",
        Method: req.method,
        Path: fullPath,
        StatusCode: res.statusCode,
        Changes: summarizePayload(req.body),
        IP: req.ip ?? req.connection?.remoteAddress ?? "",
        UserAgent: (req.get("user-agent") ?? "").slice(0, 200),
        DurationMs: Math.round(durationMs)
      };

      AuditLog.create(entry).catch((err) => {
        logger.warn(`[audit] failed to write log: ${err.message}`);
      });
    });
    next();
  };
}

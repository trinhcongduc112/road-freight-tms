import { ApiError } from "../utils/apiError.js";
import { hasAllPermissions, hasAnyPermission } from "../config/permissions.js";

/**
 * BA 3.1.2 — RBAC: kiểm tra theo permission code (`module:action`).
 *
 *  - Super admin (User.IsSuperAdmin) tự động pass mọi check.
 *  - Wildcard `*` ⇒ full access.
 *  - Wildcard `<module>:*` ⇒ full quyền trên module.
 *  - Khớp chính xác `module:action`.
 *
 * Cách dùng:
 *   requirePermission("customer:read")                     // 1 quyền
 *   requirePermission("customer:read", "customer:update")  // AND nhiều quyền (ALL)
 *   requireAnyPermission("order:read", "task:read")        // OR (ANY)
 */
export function requirePermission(...needed) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, "Not authenticated"));
    if (req.user.IsSuperAdmin) return next();

    const granted = req.role?.Permissions ?? [];
    if (hasAllPermissions(granted, needed)) return next();

    return next(new ApiError(403, `Missing permission: ${needed.join(", ")}`));
  };
}

export function requireAnyPermission(...needed) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, "Not authenticated"));
    if (req.user.IsSuperAdmin) return next();

    const granted = req.role?.Permissions ?? [];
    if (hasAnyPermission(granted, needed)) return next();

    return next(
      new ApiError(403, `Missing one of permissions: ${needed.join(", ")}`)
    );
  };
}

export function requireSuperAdmin(req, _res, next) {
  if (!req.user) return next(new ApiError(401, "Not authenticated"));
  if (!req.user.IsSuperAdmin) return next(new ApiError(403, "Super admin only"));
  next();
}

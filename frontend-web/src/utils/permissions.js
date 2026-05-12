import { useAuthStore } from "../store/authStore";

// Khớp với Modules trong backend/src/config/permissions.js
export const Permissions = {
  ALL: "*",
  ORG_MANAGE:      "organization:manage",
  USER_MANAGE:     "user:manage",
  ROLE_MANAGE:     "role_group:manage",
  CUSTOMER_MANAGE: "customer:manage",
  PRODUCT_MANAGE:  "product:manage",
  VEHICLE_MANAGE:  "vehicle:manage",
  DRIVER_MANAGE:   "driver:manage",
  SERVICE_MANAGE:  "service:manage",
  ORDER_MANAGE:    "order:manage",
  ROUTE_PLAN_READ: "route_plan:read",
  ROUTE_PLAN_MANAGE: "route_plan:manage",
  TRIP_READ:       "trip:read",
  REPORT_VIEW:     "report:read",
  REPORT_EXPORT:   "report:export",
};

// Permissions mặc định theo FunctionRole
// - PLANNER/DISPATCHER: quản lý vận hành, KHÔNG có báo cáo tài chính / xuất Excel
// - ACCOUNTANT: báo cáo + xuất Excel, KHÔNG quản lý vận hành
// - IT_ADMIN: quản trị hệ thống (user/org/role) + toàn quyền vận hành
const FUNCTION_ROLE_PERMS = {
  IT_ADMIN: [
    "organization:manage", "user:manage", "role_group:manage",
    "customer:manage", "product:manage", "vehicle:manage", "driver:manage", "service:manage",
    "order:manage", "route_plan:manage", "trip:read",
    "report:read", "report:export",
  ],
  PLANNER: [
    "customer:read", "product:read", "vehicle:read", "driver:read", "service:read",
    "order:manage", "route_plan:manage", "trip:read",
  ],
  DISPATCHER: [
    "customer:read", "product:read", "vehicle:read", "driver:read", "service:read",
    "order:manage", "route_plan:manage", "trip:read",
  ],
  PLANNER_DISPATCHER: [
    "customer:manage", "product:manage", "vehicle:manage", "driver:manage", "service:manage",
    "order:manage", "route_plan:manage", "trip:read",
  ],
  ACCOUNTANT: [
    "customer:read", "product:read", "order:read", "order:export",
    "report:read", "report:export",
  ],
  DRIVER: ["order:read", "trip:read", "trip:update"],
};

export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);

  const isSuper = !!user?.IsSuperAdmin;

  // Tổng hợp permissions từ RoleGroup + FunctionRoles
  const rolePerms = role?.Permissions ?? [];
  const functionPerms = (user?.FunctionRoles ?? []).flatMap((r) => FUNCTION_ROLE_PERMS[r] ?? []);
  const perms = [...new Set([...rolePerms, ...functionPerms])];

  const isAll = perms.includes("*");

  // Khớp với hasPermission() backend:
  // - exact match
  // - module:* wildcard
  // - module:manage wildcard (nếu granted có manage thì pass mọi action)
  // - nếu required là module:manage thì pass khi có BẤT KỲ permission nào của module đó
  const can = (required) => {
    if (!required) return false;            // ← guard: undefined perm key → deny silently
    if (isSuper || isAll) return true;
    if (perms.includes(required)) return true;
    const [mod] = required.split(":");
    if (perms.includes(`${mod}:*`)) return true;
    if (perms.includes(`${mod}:manage`)) return true;
    if (required.endsWith(":manage") && perms.some((p) => p.startsWith(`${mod}:`))) return true;
    return false;
  };

  const canAny = (...list) => list.some((p) => can(p));

  return { can, canAny, isSuper, isAll, perms };
}

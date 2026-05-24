/**
 * Permission catalog — single source of truth.
 *
 * Format chuẩn: `module:action` (ví dụ: "customer:read", "route_plan:lock").
 * Wildcard:
 *   "*"           → toàn quyền (chỉ dùng cho super admin / hệ thống)
 *   "<module>:*"  → toàn quyền trên module
 *
 * Tham chiếu:
 *   - BA 3.6.2 Bảng 3.8 (RoleGroup) + 3.3 (Use Case) → tập module.
 *   - Abivin vRoute (`role.config.js`) → fine-grained Route Plan otherPermissions.
 */

export const Modules = Object.freeze({
  ORGANIZATION: "organization",
  USER: "user",
  ROLE: "role",
  CUSTOMER: "customer",
  PRODUCT: "product",
  VEHICLE: "vehicle",
  DRIVER: "driver",
  SERVICE: "service",
  ORDER: "order",
  ROUTE_PLAN: "route_plan",
  TRIP: "trip",
  TASK: "task",
  DASHBOARD: "dashboard",
  REPORT: "report"
});

export const Actions = Object.freeze({
  CREATE: "create",
  READ: "read",
  READ_ALL: "read_all",
  UPDATE: "update",
  DELETE: "delete",
  EXPORT: "export",
  IMPORT: "import"
});

/**
 * Action mịn riêng cho Route Plan (mượn từ Abivin permissionsV2.otherPermissions).
 * Dùng khi cần check ở giữa flow optimize/lock/finalize trip.
 */
export const RoutePlanActions = Object.freeze({
  OPTIMIZE: "optimize",
  LOCK: "lock",
  UNLOCK: "unlock",
  FINALIZE: "finalize",
  CLOSE_TRIP: "close_trip",
  CHANGE_DRIVER: "change_driver",
  CHANGE_VEHICLE: "change_vehicle",
  MOVE_ORDER: "move_order",
  REMOVE_ORDER: "remove_order",
  UPDATE_STOP_LOCATION: "update_stop_location"
});

export const WILDCARD_ALL = "*";

export function p(module, action) {
  return `${module}:${action}`;
}

/**
 * In ra toàn bộ permission code có trong hệ thống (UI catalog/select).
 */
export function listAllPermissions() {
  const all = [];
  for (const m of Object.values(Modules)) {
    for (const a of Object.values(Actions)) all.push(p(m, a));
  }
  for (const a of Object.values(RoutePlanActions)) {
    all.push(p(Modules.ROUTE_PLAN, a));
  }
  all.push(WILDCARD_ALL);
  return all;
}

/**
 * Match kiểm tra `granted` (mảng permission của role) có cấp `required` không.
 * Hỗ trợ:
 *   - Exact match: "customer:read" matches "customer:read".
 *   - Module wildcard: "customer:*" matches mọi action trên customer.
 *   - Module manage: "customer:manage" matches mọi action trên customer.
 *   - Global wildcard: "*" matches tất.
 */
export function hasPermission(granted, required) {
  if (!Array.isArray(granted) || granted.length === 0) return false;
  if (granted.includes(WILDCARD_ALL)) return true;
  if (granted.includes(required)) return true;

  const colonIdx = required.indexOf(":");
  if (colonIdx === -1) return false;
  const module = required.slice(0, colonIdx);
  return granted.includes(`${module}:*`) || granted.includes(`${module}:manage`);
}

/**
 * Boolean: granted có chứa MỌI required không (AND).
 */
export function hasAllPermissions(granted, required) {
  return required.every((r) => hasPermission(granted, r));
}

/**
 * Boolean: granted có chứa ÍT NHẤT 1 trong required không (OR).
 */
export function hasAnyPermission(granted, required) {
  return required.some((r) => hasPermission(granted, r));
}

/* ──────────────────────────────────────────────────────────────────
 * Preset templates — dùng khi auto-create role.
 *
 *  - ADMIN_TEMPLATE: gán cho `AD-{ORG_CODE}` khi tạo org mới.
 *    Đầy đủ tất cả module, kèm fine-grained route_plan.
 *
 *  - DELIVERER_TEMPLATE (Driver): least-privilege cho mobile app
 *    (mượn từ Abivin DELIVERER seed).
 *
 *  - DISPATCHER_TEMPLATE: planner ở cấp Branch / Distributor.
 * ──────────────────────────────────────────────────────────────── */

const allActionsOf = (m) => Object.values(Actions).map((a) => p(m, a));

export const ADMIN_TEMPLATE_PERMISSIONS = Object.freeze([WILDCARD_ALL]);

export const DELIVERER_TEMPLATE_PERMISSIONS = Object.freeze([
  p(Modules.ORGANIZATION, Actions.READ),
  p(Modules.CUSTOMER, Actions.READ),
  p(Modules.PRODUCT, Actions.READ),
  p(Modules.ORDER, Actions.READ),
  p(Modules.TASK, Actions.READ),
  p(Modules.TASK, Actions.UPDATE),
  p(Modules.TRIP, Actions.READ),
  p(Modules.TRIP, Actions.UPDATE)
]);

/**
 * PLANNER — Người LẬP KẾ HOẠCH vận tải.
 * Chính: tạo plan, tối ưu tuyến, phân tài xế/xe, lock & finalize.
 * Không: theo dõi realtime chuyến đang chạy (chỉ đọc), không kế toán.
 */
export const PLANNER_TEMPLATE_PERMISSIONS = Object.freeze([
  p(Modules.ORGANIZATION, Actions.READ),
  p(Modules.ORGANIZATION, Actions.READ_ALL),
  ...allActionsOf(Modules.CUSTOMER),
  ...allActionsOf(Modules.PRODUCT),
  ...allActionsOf(Modules.VEHICLE),
  ...allActionsOf(Modules.DRIVER),
  ...allActionsOf(Modules.SERVICE),
  p(Modules.ORDER, Actions.READ),
  p(Modules.ORDER, Actions.UPDATE),
  ...allActionsOf(Modules.ROUTE_PLAN),
  p(Modules.ROUTE_PLAN, RoutePlanActions.OPTIMIZE),
  p(Modules.ROUTE_PLAN, RoutePlanActions.LOCK),
  p(Modules.ROUTE_PLAN, RoutePlanActions.UNLOCK),
  p(Modules.ROUTE_PLAN, RoutePlanActions.FINALIZE),
  p(Modules.ROUTE_PLAN, RoutePlanActions.CHANGE_DRIVER),
  p(Modules.ROUTE_PLAN, RoutePlanActions.CHANGE_VEHICLE),
  p(Modules.ROUTE_PLAN, RoutePlanActions.MOVE_ORDER),
  p(Modules.ROUTE_PLAN, RoutePlanActions.REMOVE_ORDER),
  p(Modules.TRIP, Actions.READ),
  p(Modules.TASK, Actions.READ),
  p(Modules.DASHBOARD, Actions.READ)
]);

/**
 * DISPATCHER — Người ĐIỀU PHỐI realtime.
 * Chính: giám sát chuyến chạy, đổi tài xế/xe, close trip, xử lý sự cố.
 * Không: lập plan / optimize từ đầu (planner làm).
 */
export const DISPATCHER_TEMPLATE_PERMISSIONS = Object.freeze([
  p(Modules.ORGANIZATION, Actions.READ),
  p(Modules.ORGANIZATION, Actions.READ_ALL),
  p(Modules.CUSTOMER, Actions.READ),
  p(Modules.PRODUCT, Actions.READ),
  p(Modules.VEHICLE, Actions.READ),
  p(Modules.DRIVER, Actions.READ),
  p(Modules.SERVICE, Actions.READ),
  p(Modules.ORDER, Actions.READ),
  p(Modules.ROUTE_PLAN, Actions.READ),
  p(Modules.ROUTE_PLAN, RoutePlanActions.CLOSE_TRIP),
  p(Modules.ROUTE_PLAN, RoutePlanActions.CHANGE_DRIVER),
  p(Modules.ROUTE_PLAN, RoutePlanActions.CHANGE_VEHICLE),
  ...allActionsOf(Modules.TRIP),
  p(Modules.TASK, Actions.READ),
  p(Modules.TASK, Actions.UPDATE),
  p(Modules.DASHBOARD, Actions.READ)
]);

/**
 * PLANNER_DISPATCHER — Người làm CẢ HAI vai trò (doanh nghiệp nhỏ).
 * Gộp full quyền PLANNER + DISPATCHER.
 */
export const PLANNER_DISPATCHER_TEMPLATE_PERMISSIONS = Object.freeze([
  ...new Set([...PLANNER_TEMPLATE_PERMISSIONS, ...DISPATCHER_TEMPLATE_PERMISSIONS])
]);

/**
 * ACCOUNTANT — Kế toán vận tải.
 * Chính: xem báo cáo doanh thu/chi phí, bảng lương tài xế, xuất Excel.
 * Không: chỉnh sửa Master Data / Plan / Trip — chỉ READ + EXPORT.
 */
export const ACCOUNTANT_TEMPLATE_PERMISSIONS = Object.freeze([
  p(Modules.ORGANIZATION, Actions.READ),
  p(Modules.ORGANIZATION, Actions.READ_ALL),
  p(Modules.CUSTOMER, Actions.READ),
  p(Modules.PRODUCT, Actions.READ),
  p(Modules.VEHICLE, Actions.READ),
  p(Modules.DRIVER, Actions.READ),
  p(Modules.SERVICE, Actions.READ),
  p(Modules.ORDER, Actions.READ),
  p(Modules.ORDER, Actions.EXPORT),
  p(Modules.ROUTE_PLAN, Actions.READ),
  p(Modules.TRIP, Actions.READ),
  p(Modules.DASHBOARD, Actions.READ),
  p(Modules.REPORT, Actions.READ),
  p(Modules.REPORT, Actions.EXPORT)
]);

/**
 * Trả về preset code → tên hiển thị → mảng permissions.
 * Dùng cho endpoint catalog & UI "Apply preset".
 */
export const RolePresets = Object.freeze({
  ADMIN: {
    code: "AD",
    nameVi: "Quản trị tổ chức",
    nameEn: "Organization Admin",
    isSystem: true,
    permissions: ADMIN_TEMPLATE_PERMISSIONS
  },
  DELIVERER: {
    code: "DELIVERER",
    nameVi: "Nhân viên giao hàng (Driver)",
    nameEn: "Driver / Deliverer",
    isSystem: false,
    permissions: DELIVERER_TEMPLATE_PERMISSIONS
  },
  PLANNER: {
    code: "PLANNER",
    nameVi: "Người lập kế hoạch",
    nameEn: "Planner",
    isSystem: false,
    description: "Tạo & tối ưu lộ trình, phân tài xế/xe, khoá & chốt kế hoạch.",
    permissions: PLANNER_TEMPLATE_PERMISSIONS
  },
  DISPATCHER: {
    code: "DISPATCHER",
    nameVi: "Người điều phối",
    nameEn: "Dispatcher",
    isSystem: false,
    description: "Giám sát chuyến realtime, đổi tài xế/xe, đóng chuyến, xử lý sự cố.",
    permissions: DISPATCHER_TEMPLATE_PERMISSIONS
  },
  PLANNER_DISPATCHER: {
    code: "PLANNER_DISPATCHER",
    nameVi: "Lập kế hoạch & Điều phối",
    nameEn: "Planner & Dispatcher",
    isSystem: false,
    description: "Gộp 2 vai trò — phù hợp doanh nghiệp nhỏ.",
    permissions: PLANNER_DISPATCHER_TEMPLATE_PERMISSIONS
  },
  ACCOUNTANT: {
    code: "ACCOUNTANT",
    nameVi: "Kế toán vận tải",
    nameEn: "Accountant",
    isSystem: false,
    description: "Xem báo cáo doanh thu, chi phí, bảng lương tài xế, xuất Excel.",
    permissions: ACCOUNTANT_TEMPLATE_PERMISSIONS
  }
});

/**
 * Sinh code chuẩn cho admin role của 1 Org: "AD-{ORG_CODE}".
 * Ví dụ: tạo Org "DEMO" → tạo role "AD-DEMO".
 */
export function adminRoleCodeFor(orgCode) {
  return `AD-${String(orgCode).toUpperCase()}`;
}

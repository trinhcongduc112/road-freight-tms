import mongoose from "mongoose";
import {
  Modules,
  Actions,
  RoutePlanActions,
  WILDCARD_ALL,
  p
} from "../config/permissions.js";

/**
 * BA 3.6.2 — Bảng 3.8. Đặc tả bảng RoleGroup.
 * BA 3.1.3 — 2 loại nhóm:
 *   Admin Group  : CRUD trên Org hiện tại + toàn bộ Org con.
 *   Normal Group : CRUD chỉ trong Org trực thuộc.
 *
 * Tham chiếu Abivin (chỉ áp dụng phần phù hợp với BA):
 *   - Mỗi Org tạo ra → tự sinh role `AD-{ORG_CODE}` (locked, không xóa được).
 *   - Permissions[] dùng format `module:action` (vd "customer:read"). Wildcard `*` & `<module>:*`.
 *   - Configurations.SeeChildren cho phép NORMAL group mở rộng scope xuống cây con
 *     (tương đương `seeChildren` của Abivin).
 */
export const RoleGroupKind = Object.freeze({
  ADMIN: "admin",
  NORMAL: "normal"
});

/**
 * @deprecated Dùng `import { p, Modules, Actions } from "../config/permissions.js"` thay vì hằng số ở đây.
 * Object này được giữ để các route hiện tại không bị vỡ — sẽ remove sau khi refactor xong.
 */
export const Permissions = Object.freeze({
  ALL: WILDCARD_ALL,
  ORG_MANAGE: `${Modules.ORGANIZATION}:*`,
  USER_MANAGE: `${Modules.USER}:*`,
  ROLE_MANAGE: `${Modules.ROLE}:*`,
  CUSTOMER_MANAGE: `${Modules.CUSTOMER}:*`,
  PRODUCT_MANAGE: `${Modules.PRODUCT}:*`,
  VEHICLE_MANAGE: `${Modules.VEHICLE}:*`,
  DRIVER_MANAGE: `${Modules.DRIVER}:*`,
  SERVICE_MANAGE: `${Modules.SERVICE}:*`,
  ORDER_MANAGE: `${Modules.ORDER}:*`,
  TRIP_PLAN: p(Modules.ROUTE_PLAN, Actions.CREATE),
  TRIP_EXECUTE: p(Modules.TRIP, Actions.UPDATE),
  TRIP_MONITOR: p(Modules.TRIP, Actions.READ),
  REPORT_VIEW: p(Modules.REPORT, Actions.READ),
  ROUTE_PLAN_LOCK: p(Modules.ROUTE_PLAN, RoutePlanActions.LOCK),
  ROUTE_PLAN_OPTIMIZE: p(Modules.ROUTE_PLAN, RoutePlanActions.OPTIMIZE)
});

const roleGroupSchema = new mongoose.Schema(
  {
    XCode: { type: String, required: true, uppercase: true, trim: true },
    XName: { type: String, required: true, trim: true },
    Kind: {
      type: String,
      enum: Object.values(RoleGroupKind),
      default: RoleGroupKind.NORMAL
    },

    Permissions: { type: [String], default: [] },

    OrganizationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },

    /**
     * Cấu hình hành vi role:
     *   SeeChildren: NORMAL group có nhìn thấy resource của org con không.
     *                ADMIN group luôn = true bất kể giá trị này.
     *   OrderApprovalRole: gắn role này vào pipeline duyệt order
     *                     (ORDER_ISSUER / ORDER_INSPECTOR / ROUTE_PLANNER) — sprint sau.
     */
    Configurations: {
      SeeChildren: { type: Boolean, default: false },
      OrderApprovalRole: {
        type: String,
        enum: ["", "ORDER_ISSUER", "ORDER_INSPECTOR", "ROUTE_PLANNER"],
        default: ""
      }
    },

    /**
     * IsSystem: role do hệ thống tự sinh (vd `AD-{ORG_CODE}`),
     * không cho phép xóa hoặc đổi `Kind`. Tương đương `isLocked` của Abivin.
     */
    IsSystem: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

roleGroupSchema.index({ OrganizationID: 1, XCode: 1 }, { unique: true });
roleGroupSchema.index({ Kind: 1, OrganizationID: 1 });

export const RoleGroup = mongoose.model("RoleGroup", roleGroupSchema);

import mongoose from "mongoose";
import { Organization } from "../models/Organization.js";
import { RoleGroup, RoleGroupKind } from "../models/RoleGroup.js";
import {
  Modules,
  Actions,
  RoutePlanActions,
  WILDCARD_ALL,
  RolePresets,
  listAllPermissions
} from "../config/permissions.js";
import { ApiError } from "../utils/apiError.js";
import { assertOrgInScope, scopeFilter } from "../middlewares/dac.js";

export async function listRoleGroups(req, res) {
  const filter = scopeFilter(req.orgScope, "OrganizationID");
  if (req.query.organizationId) {
    if (req.orgScope) assertOrgInScope(req.orgScope, req.query.organizationId);
    filter.OrganizationID = req.query.organizationId;
  }
  const items = await RoleGroup.find(filter).sort({ XCode: 1 }).lean();
  res.json({ success: true, data: items });
}

/**
 * GET /api/role-groups/catalog
 * Trả về toàn bộ vocab cần để FE dựng form tạo/sửa role:
 *   - kinds: ADMIN/NORMAL
 *   - modules + actions
 *   - routePlanActions (mịn cho route plan)
 *   - permissions: list cụ thể "module:action" + "module:*"
 *   - presets: ADMIN/DELIVERER/DISPATCHER cho nút "Apply preset".
 */
export async function listPermissionCatalog(_req, res) {
  res.json({
    success: true,
    data: {
      kinds: Object.values(RoleGroupKind),
      modules: Modules,
      actions: Actions,
      routePlanActions: RoutePlanActions,
      wildcards: { ALL: WILDCARD_ALL },
      permissions: listAllPermissions(),
      presets: RolePresets
    }
  });
}

export async function createRoleGroup(req, res) {
  const {
    XCode,
    XName,
    Kind,
    Permissions: perms,
    OrganizationID,
    Configurations
  } = req.body ?? {};

  if (!XCode || !XName || !OrganizationID) {
    throw new ApiError(400, "XCode, XName, OrganizationID are required");
  }
  if (Kind && !Object.values(RoleGroupKind).includes(Kind)) {
    throw new ApiError(400, "Invalid Kind");
  }
  assertOrgInScope(req.orgScope, OrganizationID);

  const codeUpper = XCode.toUpperCase();
  if (codeUpper.startsWith("AD-")) {
    throw new ApiError(400, "Code prefix 'AD-' is reserved for system admin roles");
  }

  const dup = await RoleGroup.findOne({ OrganizationID, XCode: codeUpper });
  if (dup) throw new ApiError(409, "RoleGroup XCode already exists in this organization");

  const role = await RoleGroup.create({
    XCode: codeUpper,
    XName,
    Kind: Kind ?? RoleGroupKind.NORMAL,
    Permissions: Array.isArray(perms) ? perms : [],
    OrganizationID,
    Configurations: {
      SeeChildren: !!Configurations?.SeeChildren,
      OrderApprovalRole: Configurations?.OrderApprovalRole ?? ""
    },
    IsSystem: false
  });
  res.status(201).json({ success: true, data: role });
}

export async function updateRoleGroup(req, res) {
  const role = await RoleGroup.findById(req.params.id);
  if (!role) throw new ApiError(404, "RoleGroup not found");
  assertOrgInScope(req.orgScope, role.OrganizationID);

  const { XName, Kind, Permissions: perms, Configurations } = req.body ?? {};

  if (role.IsSystem && Kind !== undefined && Kind !== role.Kind) {
    throw new ApiError(403, "Cannot change Kind of a system role");
  }

  if (XName !== undefined) role.XName = XName;
  if (Kind !== undefined) {
    if (!Object.values(RoleGroupKind).includes(Kind)) throw new ApiError(400, "Invalid Kind");
    role.Kind = Kind;
  }
  if (Array.isArray(perms)) {
    if (role.IsSystem && !perms.includes(WILDCARD_ALL)) {
      throw new ApiError(403, "System admin role must keep wildcard '*' permission");
    }
    role.Permissions = perms;
  }
  if (Configurations) {
    if (Configurations.SeeChildren !== undefined) {
      role.Configurations.SeeChildren = !!Configurations.SeeChildren;
    }
    if (Configurations.OrderApprovalRole !== undefined) {
      role.Configurations.OrderApprovalRole = Configurations.OrderApprovalRole ?? "";
    }
  }

  await role.save();
  res.json({ success: true, data: role });
}

export async function deleteRoleGroup(req, res) {
  const role = await RoleGroup.findById(req.params.id);
  if (!role) throw new ApiError(404, "RoleGroup not found");
  assertOrgInScope(req.orgScope, role.OrganizationID);
  if (role.IsSystem) {
    throw new ApiError(403, "Cannot delete a system role (auto-generated for organization)");
  }
  await role.deleteOne();
  res.json({ success: true });
}

/**
 * POST /api/role-groups/import
 * Bulk-create role groups from Excel rows.
 * Each row: { XCode, XName, Kind, OrganizationID }
 */
export async function importRoleGroups(req, res) {
  const { rows = [] } = req.body ?? {};
  if (!Array.isArray(rows) || rows.length === 0) throw new ApiError(400, "rows là bắt buộc");

  let created = 0, skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const xCode = row["XCode"] ? String(row["XCode"]).trim().toUpperCase() : null;
    const xName = row["XName"] ? String(row["XName"]).trim() : null;
    let orgId = row["OrganizationID"] ? String(row["OrganizationID"]).trim() : null;
    if (!xCode || !xName || !orgId) { errors.push({ row: i + 2, reason: "XCode, XName, OrganizationID là bắt buộc" }); continue; }

    if (xCode.startsWith("AD-")) { errors.push({ row: i + 2, reason: "Prefix AD- là dành riêng cho hệ thống" }); continue; }

    if (!mongoose.isValidObjectId(orgId)) {
      const found = await Organization.findOne({ XCode: orgId.toUpperCase() }).lean();
      if (!found) { errors.push({ row: i + 2, reason: `Không tìm thấy tổ chức với mã: ${orgId}` }); continue; }
      orgId = found._id.toString();
    }

    try {
      assertOrgInScope(req.orgScope, orgId);
    } catch { errors.push({ row: i + 2, reason: "OrganizationID ngoài phạm vi" }); continue; }

    const dup = await RoleGroup.findOne({ OrganizationID: orgId, XCode: xCode });
    if (dup) { skipped++; continue; }

    const kindInput = row["Kind"] ? String(row["Kind"]).trim().toLowerCase() : "normal";
    const kind = Object.values(RoleGroupKind).includes(kindInput) ? kindInput : RoleGroupKind.NORMAL;

    try {
      await RoleGroup.create({
        XCode: xCode,
        XName: xName,
        Kind: kind,
        Permissions: [],
        OrganizationID: orgId,
        IsSystem: false
      });
      created++;
    } catch (e) { errors.push({ row: i + 2, reason: e.message }); }
  }

  res.json({ success: true, data: { created, skipped, errors } });
}

import mongoose from "mongoose";
import { Organization, OrgType } from "../models/Organization.js";
import { RoleGroup, RoleGroupKind } from "../models/RoleGroup.js";
import {
  ADMIN_TEMPLATE_PERMISSIONS,
  RolePresets,
  adminRoleCodeFor
} from "../config/permissions.js";
import { ApiError } from "../utils/apiError.js";
import { assertOrgInScope, scopeFilter } from "../middlewares/dac.js";

const ORG_CHILD_TYPE = {
  [OrgType.MANUFACTURER]: OrgType.BRANCH,
  [OrgType.BRANCH]: OrgType.DEPOT
};
const ROOT_ORG_TYPE = OrgType.MANUFACTURER;

function expectedOrgTypeForParent(parent) {
  return parent ? ORG_CHILD_TYPE[parent.OrgType] : ROOT_ORG_TYPE;
}

function assertOrgHierarchy(parent, orgType) {
  const expected = expectedOrgTypeForParent(parent);
  if (!expected) throw new ApiError(400, "DEPOT không được có tổ chức con");
  if (orgType !== expected) {
    throw new ApiError(400, parent
      ? `OrgType dưới ${parent.OrgType} phải là ${expected}`
      : `Tổ chức gốc phải là ${expected}`);
  }
}

/** GET /api/organizations */
export async function listOrganizations(req, res) {
  const filter = scopeFilter(req.orgScope, "_id");
  const orgs = await Organization.find(filter).sort({ XCode: 1 }).lean();
  res.json({ success: true, data: orgs });
}

/** GET /api/organizations/tree */
export async function getTree(req, res) {
  const filter = scopeFilter(req.orgScope, "_id");
  const orgs = await Organization.find(filter).lean();
  const map = new Map(orgs.map((o) => [o._id.toString(), { ...o, children: [] }]));
  const roots = [];
  for (const o of map.values()) {
    const parentId = o.Parent?.toString();
    if (parentId && map.has(parentId)) map.get(parentId).children.push(o);
    else roots.push(o);
  }
  res.json({ success: true, data: roots });
}

/** GET /api/organizations/:id */
export async function getOrganization(req, res) {
  const org = await Organization.findById(req.params.id).lean();
  if (!org) throw new ApiError(404, "Organization not found");
  assertOrgInScope(req.orgScope, org._id);
  res.json({ success: true, data: org });
}

/**
 * POST /api/organizations
 * BA 3.1.1 — Người dùng có thể tạo Org cha–con không giới hạn.
 *
 * Khi tạo Org mới, hệ thống TỰ SINH role `AD-{ORG_CODE}` (locked) gắn với Org đó —
 * mượn từ Abivin để admin của Org có sẵn quyền CRUD đầy đủ + see-children.
 * Org được auto-add vào User.OrganizationIDs (BA: user tạo ra Org thì thuộc tập A).
 */
export async function createOrganization(req, res) {
  const {
    XCode,
    XName,
    Address,
    Status,
    OrgType: orgTypeInput,
    ParentID,
    Latitude,
    Longitude,
    OpenTime,
    CloseTime,
    Phone,
    Country,
    Currency,
    TimeZone
  } = req.body ?? {};

  if (!XCode || !XName) throw new ApiError(400, "XCode and XName are required");

  if (orgTypeInput && !Object.values(OrgType).includes(orgTypeInput)) {
    throw new ApiError(400, "Invalid OrgType");
  }

  const codeUpper = XCode.toUpperCase();
  const dup = await Organization.findOne({ XCode: codeUpper });
  if (dup) throw new ApiError(409, "XCode already exists");

  let parent = null;
  let path = [];
  if (ParentID) {
    if (!mongoose.isValidObjectId(ParentID)) throw new ApiError(400, "Invalid ParentID");
    parent = await Organization.findById(ParentID);
    if (!parent) throw new ApiError(404, "Parent organization not found");
    assertOrgInScope(req.orgScope, parent._id);
    path = [...parent.Path, parent._id];
  }

  const normalizedOrgType = orgTypeInput ?? expectedOrgTypeForParent(parent);
  assertOrgHierarchy(parent, normalizedOrgType);

  const org = await Organization.create({
    XCode: codeUpper,
    XName,
    Address: Address ?? "",
    Status: Status ?? "Active",
    OrgType: normalizedOrgType,
    Parent: parent?._id ?? null,
    Path: path,
    Latitude: Latitude ?? null,
    Longitude: Longitude ?? null,
    OpenTime: OpenTime ?? null,
    CloseTime: CloseTime ?? null,
    Phone: Phone ?? "",
    Country: Country ?? "",
    Currency: Currency ?? "",
    TimeZone: TimeZone ?? "",
    CreatedBy: req.user._id
  });

  await RoleGroup.create({
    XCode: adminRoleCodeFor(codeUpper),
    XName: `${RolePresets.ADMIN.nameVi} (${codeUpper})`,
    Kind: RoleGroupKind.ADMIN,
    Permissions: [...ADMIN_TEMPLATE_PERMISSIONS],
    OrganizationID: org._id,
    Configurations: { SeeChildren: true },
    IsSystem: true
  }).catch(async (err) => {
    await Organization.deleteOne({ _id: org._id }).catch(() => {});
    throw err;
  });

  if (!req.user.IsSuperAdmin) {
    req.user.OrganizationIDs = [
      ...new Set([
        ...req.user.OrganizationIDs.map(String),
        org._id.toString()
      ])
    ];
    await req.user.save();
  }

  res.status(201).json({ success: true, data: org });
}

/** PUT /api/organizations/:id */
export async function updateOrganization(req, res) {
  const org = await Organization.findById(req.params.id);
  if (!org) throw new ApiError(404, "Organization not found");
  assertOrgInScope(req.orgScope, org._id);

  const updatable = [
    "XName",
    "Address",
    "Status",
    "OrgType",
    "Latitude",
    "Longitude",
    "OpenTime",
    "CloseTime",
    "Phone",
    "Country",
    "Currency",
    "TimeZone"
  ];
  for (const key of updatable) {
    if (req.body?.[key] !== undefined) org[key] = req.body[key];
  }
  if (req.body?.Status !== undefined && !["Active", "Inactive"].includes(req.body.Status)) {
    throw new ApiError(400, "Invalid Status");
  }
  if (
    req.body?.OrgType !== undefined &&
    req.body.OrgType !== null &&
    !Object.values(OrgType).includes(req.body.OrgType)
  ) {
    throw new ApiError(400, "Invalid OrgType");
  }

  if (req.body?.OrgType !== undefined) {
    const parent = org.Parent ? await Organization.findById(org.Parent).lean() : null;
    assertOrgHierarchy(parent, req.body.OrgType);
    const expectedChildType = ORG_CHILD_TYPE[req.body.OrgType];
    const children = await Organization.find({ Parent: org._id }).lean();
    const invalidChild = children.find((child) => child.OrgType !== expectedChildType);
    if (invalidChild) throw new ApiError(400, `Không thể đổi loại: tổ chức con phải là ${expectedChildType}`);
  }

  await org.save();
  res.json({ success: true, data: org });
}

/**
 * DELETE /api/organizations/:id
 * Không cho xóa nếu còn Org con. Khi xóa thành công, xóa luôn role hệ thống AD-{CODE}.
 */
export async function deleteOrganization(req, res) {
  const org = await Organization.findById(req.params.id);
  if (!org) throw new ApiError(404, "Organization not found");
  assertOrgInScope(req.orgScope, org._id);

  const childCount = await Organization.countDocuments({ Parent: org._id });
  if (childCount > 0) throw new ApiError(409, "Cannot delete: organization has children");

  await RoleGroup.deleteMany({ OrganizationID: org._id, IsSystem: true });
  await org.deleteOne();
  res.json({ success: true });
}

/**
 * POST /api/organizations/import
 * Bulk-create organizations from Excel rows.
 * Each row: { XCode, XName, OrgType, Address, Latitude, Longitude, OpenTime, CloseTime }
 */
export async function importOrganizations(req, res) {
  const { rows = [] } = req.body ?? {};
  if (!Array.isArray(rows) || rows.length === 0) throw new ApiError(400, "rows là bắt buộc");

  let created = 0, skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const xCode = row["XCode"] ? String(row["XCode"]).trim().toUpperCase() : null;
    const xName = row["XName"] ? String(row["XName"]).trim() : null;
    if (!xCode || !xName) { errors.push({ row: i + 2, reason: "XCode và XName là bắt buộc" }); continue; }

    const dup = await Organization.findOne({ XCode: xCode });
    if (dup) { skipped++; continue; }

    const orgTypeInput = row["OrgType"] ? String(row["OrgType"]).trim().toUpperCase() : null;
    if (orgTypeInput && !Object.values(OrgType).includes(orgTypeInput)) {
      errors.push({ row: i + 2, reason: `OrgType không hợp lệ: ${orgTypeInput}` }); continue;
    }

    try {
      const org = await Organization.create({
        XCode: xCode,
        XName: xName,
        OrgType: orgTypeInput ?? "MANUFACTURER",
        Address: row["Address"] ? String(row["Address"]).trim() : "",
        Latitude: row["Latitude"] ? parseFloat(row["Latitude"]) : null,
        Longitude: row["Longitude"] ? parseFloat(row["Longitude"]) : null,
        OpenTime: row["OpenTime"] ? String(row["OpenTime"]).trim() : null,
        CloseTime: row["CloseTime"] ? String(row["CloseTime"]).trim() : null,
        Status: "Active",
        Parent: null,
        Path: []
      });

      const adminCode = `AD-${xCode}`.substring(0, 50);
      await RoleGroup.create({
        XCode: adminCode,
        XName: `Admin — ${xName}`,
        Kind: RoleGroupKind.ADMIN,
        Permissions: ADMIN_TEMPLATE_PERMISSIONS,
        OrganizationID: org._id,
        IsSystem: true,
        Configurations: { SeeChildren: true }
      }).catch(() => {});

      created++;
    } catch (e) { errors.push({ row: i + 2, reason: e.message }); }
  }

  res.json({ success: true, data: { created, skipped, errors } });
}

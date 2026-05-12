import { Organization } from "../models/Organization.js";
import { RoleGroupKind } from "../models/RoleGroup.js";

/**
 * BA 3.1.2 — DAC: phạm vi đọc theo cây tổ chức.
 *
 * Tập A = User.OrganizationIDs (các Org user được gán trực tiếp).
 * Tập scope:
 *   - SuperAdmin              → null (no filter, xem hết).
 *   - Kind = ADMIN            → A + tất cả con cháu của A (BFS theo Path[]).
 *   - Kind = NORMAL
 *       + SeeChildren = true  → A + con cháu (mượn từ Abivin "seeChildren").
 *       + SeeChildren = false → đúng A.
 *
 * resolveOrgScope(req) → Set<string ObjectId> | null.
 */
export async function resolveOrgScope(req) {
  if (!req.user) return new Set();
  if (req.user.IsSuperAdmin) return null;

  const ownedIds = (req.user.OrganizationIDs ?? []).map((id) => id.toString());
  if (ownedIds.length === 0) return new Set();

  const isAdminKind = req.role?.Kind === RoleGroupKind.ADMIN;
  const seeChildren =
    isAdminKind || req.role?.Configurations?.SeeChildren === true;

  if (!seeChildren) {
    return new Set(ownedIds);
  }

  const descendants = await Organization.find(
    { Path: { $in: ownedIds } },
    { _id: 1 }
  ).lean();

  const scope = new Set(ownedIds);
  for (const org of descendants) scope.add(org._id.toString());
  return scope;
}

export async function attachOrgScope(req, _res, next) {
  try {
    req.orgScope = await resolveOrgScope(req);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Build Mongo filter để giới hạn truy vấn theo phạm vi org.
 * @param {Set<string>|null} scope
 * @param {string} field "OrganizationID" (single) hoặc "OrganizationIDs" (array)
 */
export function scopeFilter(scope, field = "OrganizationID") {
  if (scope === null) return {};
  const ids = Array.from(scope);
  if (ids.length === 0) return { _id: null };
  return { [field]: { $in: ids } };
}

export function assertOrgInScope(scope, orgId) {
  if (scope === null) return;
  if (!scope.has(orgId.toString())) {
    const err = new Error("Organization out of scope");
    err.statusCode = 403;
    throw err;
  }
}

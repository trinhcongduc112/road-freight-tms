import mongoose from "mongoose";
import { Organization } from "../models/Organization.js";
import { RoleGroup } from "../models/RoleGroup.js";
import { User, UserStatus, FunctionRole } from "../models/User.js";
import { ApiError } from "../utils/apiError.js";
import { assertOrgInScope, scopeFilter } from "../middlewares/dac.js";
import { generateToken, expiresIn, TOKEN_TTL } from "../utils/tokens.js";
import { sendInvitationEmail } from "../services/emailService.js";
import { logger } from "../utils/logger.js";

function toDTO(user) {
  return {
    _id: user._id,
    XCode: user.XCode,
    UserName: user.UserName,
    FullName: user.FullName,
    Email: user.Email,
    Phone: user.Phone,
    OrganizationIDs: user.OrganizationIDs,
    RoleGroupID: user.RoleGroupID,
    FunctionRoles: user.FunctionRoles ?? [],
    AllowedVehicleTypes: user.AllowedVehicleTypes ?? [],
    IsSuperAdmin: user.IsSuperAdmin,
    IsActive: user.IsActive,
    Status: user.Status,
    EmailVerifiedAt: user.EmailVerifiedAt,
    LastLoginAt: user.LastLoginAt,
    InvitedAt: user.InvitedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

async function resolveRoleGroupId(roleGroupId, orgScope) {
  if (!roleGroupId) return null;
  const roleGroup = await RoleGroup.findById(roleGroupId).lean();
  if (!roleGroup) throw new ApiError(404, "Không tìm thấy nhóm vai trò");
  assertOrgInScope(orgScope, roleGroup.OrganizationID);
  return roleGroup._id;
}

async function resolveRoleGroupIdFromInput(input, orgScope) {
  if (!input) return null;
  const value = String(input).trim();
  const roleGroup = mongoose.isValidObjectId(value)
    ? await RoleGroup.findById(value).lean()
    : await RoleGroup.findOne({ XCode: value.toUpperCase() }).lean();
  if (!roleGroup) throw new ApiError(404, `Không tìm thấy nhóm vai trò: ${value}`);
  assertOrgInScope(orgScope, roleGroup.OrganizationID);
  return roleGroup._id;
}

export async function listUsers(req, res) {
  const filter = scopeFilter(req.orgScope, "OrganizationIDs");
  if (req.query.organizationId) {
    if (req.orgScope) assertOrgInScope(req.orgScope, req.query.organizationId);
    filter.OrganizationIDs = req.query.organizationId;
  }
  const users = await User.find(filter).sort({ UserName: 1 }).lean();
  res.json({ success: true, data: users.map(toDTO) });
}

/**
 * POST /api/users/invite
 * Admin invite user — tạo User với Status=PENDING_INVITE, KHÔNG có password.
 * User nhận email, click link → /accept-invitation để đặt password.
 *
 * Body: { XCode?, UserName, Email, FullName?, Phone?, OrganizationIDs[], RoleGroupID? }
 */
/**
 * POST /api/users
 * Admin tạo user thủ công với mật khẩu — không cần invite email.
 * Body: { XCode?, UserName, Email, Password, FullName?, Phone?, OrganizationIDs[], FunctionRoles?, AllowedVehicleTypes? }
 */
export async function createUser(req, res) {
  const {
    XCode,
    UserName,
    Email,
    Password,
    FullName,
    Phone,
    RoleGroupID,
    OrganizationIDs = [],
    FunctionRoles: functionRoles = [],
    AllowedVehicleTypes: allowedVehicleTypes = []
  } = req.body ?? {};

  if (!UserName || !Email || !Password) {
    throw new ApiError(400, "UserName, Email và Password là bắt buộc");
  }
  if (!Array.isArray(OrganizationIDs) || OrganizationIDs.length === 0) {
    throw new ApiError(400, "OrganizationIDs phải có ít nhất 1 tổ chức");
  }
  for (const orgId of OrganizationIDs) assertOrgInScope(req.orgScope, orgId);
  const roleGroupId = await resolveRoleGroupId(RoleGroupID, req.orgScope);

  const dup = await User.findOne({ $or: [{ Email: Email.toLowerCase() }, { UserName }] });
  if (dup) throw new ApiError(409, "Email hoặc UserName đã tồn tại");

  const hash = await User.hashPassword(Password);
  const user = await User.create({
    XCode,
    UserName,
    FullName: FullName ?? "",
    Email: Email.toLowerCase(),
    Phone: Phone ?? "",
    PasswordHash: hash,
    OrganizationIDs,
    RoleGroupID: roleGroupId,
    FunctionRoles: Array.isArray(functionRoles) ? functionRoles.filter((r) => Object.values(FunctionRole).includes(r)) : [],
    AllowedVehicleTypes: Array.isArray(allowedVehicleTypes) ? allowedVehicleTypes : [],
    IsSuperAdmin: false,
    IsActive: true,
    Status: UserStatus.ACTIVE
  });

  res.status(201).json({ success: true, data: toDTO(user) });
}

export async function inviteUser(req, res) {
  const {
    XCode,
    UserName,
    Email,
    FullName,
    Phone,
    Password,
    OrganizationIDs = [],
    RoleGroupID,
    FunctionRoles: functionRoles = [],
    AllowedVehicleTypes: allowedVehicleTypes = []
  } = req.body ?? {};

  if (!UserName || !Email) {
    throw new ApiError(400, "UserName and Email are required");
  }
  if (!Array.isArray(OrganizationIDs) || OrganizationIDs.length === 0) {
    throw new ApiError(400, "OrganizationIDs must include at least one organization");
  }

  for (const orgId of OrganizationIDs) assertOrgInScope(req.orgScope, orgId);
  const roleGroupId = await resolveRoleGroupId(RoleGroupID, req.orgScope);

  const dup = await User.findOne({ $or: [{ Email: Email.toLowerCase() }, { UserName }] });
  if (dup) throw new ApiError(409, "Email or UserName already exists");

  const cleanRoles = Array.isArray(functionRoles)
    ? functionRoles.filter((r) => Object.values(FunctionRole).includes(r))
    : [];
  const cleanVehicles = Array.isArray(allowedVehicleTypes) ? allowedVehicleTypes : [];

  let user;

  if (Password && Password.length >= 6) {
    /* Admin set password directly → ACTIVE immediately, no email needed */
    const pwHash = await User.hashPassword(Password);
    user = await User.create({
      XCode, UserName, FullName: FullName ?? "", Email: Email.toLowerCase(),
      Phone: Phone ?? "", PasswordHash: pwHash, OrganizationIDs,
      RoleGroupID: roleGroupId, FunctionRoles: cleanRoles,
      AllowedVehicleTypes: cleanVehicles,
      IsSuperAdmin: false, IsActive: true, Status: UserStatus.ACTIVE,
      InvitedBy: req.user._id, InvitedAt: new Date()
    });
    return res.status(201).json({
      success: true,
      message: "User created and activated. Password set by admin.",
      data: toDTO(user)
    });
  }

  /* No password → email invite flow */
  const { raw, hash } = generateToken();
  user = await User.create({
    XCode, UserName, FullName: FullName ?? "", Email: Email.toLowerCase(),
    Phone: Phone ?? "", PasswordHash: null, OrganizationIDs,
    RoleGroupID: roleGroupId, FunctionRoles: cleanRoles,
    AllowedVehicleTypes: cleanVehicles,
    IsSuperAdmin: false, IsActive: true, Status: UserStatus.PENDING_INVITE,
    InvitationTokenHash: hash, InvitationTokenExpiresAt: expiresIn(TOKEN_TTL.INVITATION),
    InvitedBy: req.user._id, InvitedAt: new Date()
  });

  await sendInvitationEmail(user, raw, req.user).catch((err) =>
    logger.error("[inviteUser] sendInvitationEmail failed", err)
  );

  res.status(201).json({
    success: true,
    message: "Invitation sent. The user must accept it via email to activate.",
    data: toDTO(user)
  });
}

/**
 * POST /api/users/:id/resend-invitation
 * Tạo token mới + gửi lại email invite cho user đang PENDING_INVITE.
 */
export async function resendInvitation(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");
  if (req.orgScope) {
    const inScope = user.OrganizationIDs.some((id) => req.orgScope.has(id.toString()));
    if (!inScope) throw new ApiError(403, "User out of scope");
  }
  if (user.Status !== UserStatus.PENDING_INVITE) {
    throw new ApiError(400, "User is not in pending-invitation state");
  }

  const { raw, hash } = generateToken();
  user.InvitationTokenHash = hash;
  user.InvitationTokenExpiresAt = expiresIn(TOKEN_TTL.INVITATION);
  user.InvitedBy = req.user._id;
  user.InvitedAt = new Date();
  await user.save();

  await sendInvitationEmail(user, raw, req.user).catch((err) =>
    logger.error("[resendInvitation] failed", err)
  );

  res.json({ success: true, message: "Invitation re-sent." });
}

export async function updateUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");

  if (req.orgScope) {
    const inScope = user.OrganizationIDs.some((id) => req.orgScope.has(id.toString()));
    if (!inScope) throw new ApiError(403, "User out of scope");
  }

  const {
    XCode,
    UserName,
    Email,
    FullName,
    Phone,
    Password,
    OrganizationIDs,
    RoleGroupID,
    FunctionRoles: functionRoles,
    AllowedVehicleTypes: allowedVehicleTypes,
    IsActive,
    Status
  } = req.body ?? {};

  if (XCode !== undefined) user.XCode = XCode;
  if (UserName !== undefined) user.UserName = UserName;
  if (Email !== undefined) user.Email = Email.toLowerCase();
  if (FullName !== undefined) user.FullName = FullName;
  if (Phone !== undefined) user.Phone = Phone;
  if (Password && Password.length >= 6) {
    user.PasswordHash = await User.hashPassword(Password);
    if (user.Status === UserStatus.PENDING_INVITE) {
      user.Status = UserStatus.ACTIVE;
      user.InvitationTokenHash = null;
      user.InvitationTokenExpiresAt = null;
    }
  }
  if (Array.isArray(OrganizationIDs)) {
    for (const id of OrganizationIDs) assertOrgInScope(req.orgScope, id);
    user.OrganizationIDs = OrganizationIDs;
  }
  if (RoleGroupID !== undefined) user.RoleGroupID = await resolveRoleGroupId(RoleGroupID, req.orgScope);
  if (Array.isArray(functionRoles)) {
    user.FunctionRoles = functionRoles.filter((r) => Object.values(FunctionRole).includes(r));
  }
  if (Array.isArray(allowedVehicleTypes)) user.AllowedVehicleTypes = allowedVehicleTypes;
  if (IsActive !== undefined) user.IsActive = !!IsActive;
  if (Status !== undefined && Object.values(UserStatus).includes(Status)) {
    user.Status = Status;
  }

  await user.save();
  res.json({ success: true, data: toDTO(user) });
}

export async function deleteUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");
  if (user.IsSuperAdmin) throw new ApiError(403, "Cannot delete super admin");
  if (req.orgScope) {
    const inScope = user.OrganizationIDs.some((id) => req.orgScope.has(id.toString()));
    if (!inScope) throw new ApiError(403, "User out of scope");
  }
  await user.deleteOne();
  res.json({ success: true });
}

/**
 * POST /api/users/import
 * Bulk-create users from Excel rows.
 * Each row: { UserName, Email, FullName, XCode, OrganizationID, FunctionRoles (comma-sep), AllowedVehicleTypes (comma-sep) }
 */
export async function importUsers(req, res) {
  const { rows = [], defaultOrganizationId, defaultPassword = "Abc@12345" } = req.body ?? {};
  if (!Array.isArray(rows) || rows.length === 0) throw new ApiError(400, "rows là bắt buộc");

  let created = 0, skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const userName = row["UserName"] ? String(row["UserName"]).trim() : null;
    const email    = row["Email"]    ? String(row["Email"]).trim().toLowerCase() : null;
    if (!userName || !email) { errors.push({ row: i + 2, reason: "UserName và Email là bắt buộc" }); continue; }

    let orgId = row["OrganizationID"] ? String(row["OrganizationID"]).trim() : defaultOrganizationId;
    if (!orgId) { errors.push({ row: i + 2, reason: "OrganizationID là bắt buộc" }); continue; }
    if (!mongoose.isValidObjectId(orgId)) {
      const found = await Organization.findOne({ XCode: orgId.toUpperCase() }).lean();
      if (!found) { errors.push({ row: i + 2, reason: `Không tìm thấy tổ chức với mã: ${orgId}` }); continue; }
      orgId = found._id.toString();
    }
    try { assertOrgInScope(req.orgScope, orgId); } catch { errors.push({ row: i + 2, reason: "OrganizationID ngoài phạm vi" }); continue; }

    const dup = await User.findOne({ $or: [{ Email: email }, { UserName: userName }] });
    if (dup) { skipped++; continue; }

    const funcRolesRaw = row["FunctionRoles"] ? String(row["FunctionRoles"]).split(",").map((s) => s.trim().toUpperCase()) : [];
    const funcRoles = funcRolesRaw.filter((r) => Object.values(FunctionRole).includes(r));
    const vehicleTypesRaw = row["AllowedVehicleTypes"] ? String(row["AllowedVehicleTypes"]).split(",").map((s) => s.trim().toUpperCase()) : [];
    const password = row["Password"] ? String(row["Password"]).trim() : defaultPassword;
    let roleGroupId = null;
    try {
      roleGroupId = await resolveRoleGroupIdFromInput(row["RoleGroupID"] || row["RoleGroupCode"], req.orgScope);
    } catch (e) {
      errors.push({ row: i + 2, reason: e.message });
      continue;
    }

    try {
      const hash = await User.hashPassword(password);
      await User.create({
        XCode: row["XCode"] ? String(row["XCode"]).trim() : undefined,
        UserName: userName,
        FullName: row["FullName"] ? String(row["FullName"]).trim() : "",
        Email: email,
        Phone: row["Phone"] ? String(row["Phone"]).trim() : "",
        PasswordHash: hash,
        OrganizationIDs: [orgId],
        RoleGroupID: roleGroupId,
        FunctionRoles: funcRoles,
        AllowedVehicleTypes: vehicleTypesRaw,
        IsSuperAdmin: false,
        IsActive: true,
        Status: UserStatus.ACTIVE
      });
      created++;
    } catch (e) { errors.push({ row: i + 2, reason: e.message }); }
  }

  res.json({ success: true, data: { created, skipped, errors } });
}

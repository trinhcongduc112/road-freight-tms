import { Organization, OrgType } from "../models/Organization.js";
import { RoleGroup, RoleGroupKind } from "../models/RoleGroup.js";
import {
  ADMIN_TEMPLATE_PERMISSIONS,
  RolePresets,
  adminRoleCodeFor
} from "../config/permissions.js";
import { User, UserStatus } from "../models/User.js";
import { signToken, signRefreshToken, verifyRefreshToken, blacklistToken } from "../middlewares/auth.js";
import { ApiError } from "../utils/apiError.js";
import {
  generateToken,
  hashToken,
  expiresIn,
  TOKEN_TTL
} from "../utils/tokens.js";
import {
  sendVerificationEmail,
  sendResetPasswordEmail
} from "../services/emailService.js";
import { logger } from "../utils/logger.js";
import { env, isProduction } from "../config/env.js";

function toUserDTO(user) {
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
    EmailVerifiedAt: user.EmailVerifiedAt
  };
}

/**
 * Sinh OrgCode từ tên công ty: lấy chữ cái đầu mỗi từ hoặc slug 12 ký tự.
 * Nếu trùng, thêm hậu tố số tăng dần.
 */
async function generateOrgCode(companyName) {
  const slug = companyName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12);
  const base = slug || "ORG";
  let candidate = base;
  let counter = 1;
  while (await Organization.exists({ XCode: candidate })) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

/**
 * POST /api/auth/register
 * Đơn giản như Abivin: Email + FullName + CompanyName + Phone + Password.
 * OrgCode và UserName được tự sinh — người dùng không cần biết.
 * User được tạo ở trạng thái PENDING_VERIFY → cần xác thực email mới đăng nhập được.
 */
export async function register(req, res) {
  const { CompanyName, Email, Password, FullName, Phone } = req.body ?? {};

  if (!CompanyName || !Email || !Password) {
    throw new ApiError(400, "CompanyName, Email và Password là bắt buộc");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(Email)) {
    throw new ApiError(400, "Email không đúng định dạng");
  }
  if (Password.length < 8) {
    throw new ApiError(400, "Mật khẩu phải có ít nhất 8 ký tự");
  }
  const strongPwd = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
  if (!strongPwd.test(Password)) {
    throw new ApiError(400, "Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt");
  }

  const emailLower = Email.toLowerCase();
  const existed = await User.findOne({ Email: emailLower });
  if (existed) throw new ApiError(409, "Email đã được đăng ký");

  // Tự sinh UserName từ phần trước @ của email
  const emailLocal = emailLower.split("@")[0].replace(/[^a-z0-9_]/g, "").slice(0, 20);
  let UserName = emailLocal || "user";
  let suffix = 1;
  while (await User.exists({ UserName })) {
    UserName = `${emailLocal}${suffix}`;
    suffix += 1;
  }

  const OrgCode = await generateOrgCode(CompanyName);

  const { raw, hash } = generateToken();

  // MongoDB standalone không hỗ trợ multi-document transaction.
  // Best-effort cleanup nếu một bước fail giữa chừng.
  let org = null;
  let adminGroup = null;
  let createdUser = null;
  try {
    org = await Organization.create({
      XCode: OrgCode,
      XName: CompanyName,
      Address: "",
      Status: "Active",
      OrgType: OrgType.MANUFACTURER,
      Parent: null,
      Path: []
    });

    adminGroup = await RoleGroup.create({
      XCode: adminRoleCodeFor(org.XCode),
      XName: `${RolePresets.ADMIN.nameVi} (${org.XCode})`,
      Kind: RoleGroupKind.ADMIN,
      Permissions: [...ADMIN_TEMPLATE_PERMISSIONS],
      OrganizationID: org._id,
      Configurations: { SeeChildren: true },
      IsSystem: true
    });

    const passwordHash = await User.hashPassword(Password);
    createdUser = await User.create({
      UserName,
      FullName: FullName ?? "",
      Email: emailLower,
      Phone: Phone ?? "",
      PasswordHash: passwordHash,
      OrganizationIDs: [org._id],
      RoleGroupID: adminGroup._id,
      IsSuperAdmin: false,
      IsActive: true,
      Status: UserStatus.PENDING_VERIFY,
      VerificationTokenHash: hash,
      VerificationTokenExpiresAt: expiresIn(TOKEN_TTL.EMAIL_VERIFY)
    });

    org.CreatedBy = createdUser._id;
    await org.save();
  } catch (err) {
    if (createdUser) await User.deleteOne({ _id: createdUser._id }).catch(() => {});
    if (adminGroup) await RoleGroup.deleteOne({ _id: adminGroup._id }).catch(() => {});
    if (org) await Organization.deleteOne({ _id: org._id }).catch(() => {});
    throw err;
  }

  await sendVerificationEmail(createdUser, raw).catch((err) =>
    logger.error("[register] sendVerificationEmail failed", err)
  );

  const responseData = { user: toUserDTO(createdUser) };
  if (!isProduction) {
    responseData.devVerifyLink = `${env.frontendUrl}/verify-email?token=${encodeURIComponent(raw)}`;
  }

  res.status(201).json({
    success: true,
    message: "Registered. Please check your email to verify your account.",
    data: responseData
  });
}

/**
 * POST /api/auth/verify-email
 * Body: { token }
 */
export async function verifyEmail(req, res) {
  const { token } = req.body ?? {};
  if (!token) throw new ApiError(400, "Token is required");

  const tokenHash = hashToken(token);
  const user = await User.findOne({ VerificationTokenHash: tokenHash }).select(
    "+VerificationTokenHash +VerificationTokenExpiresAt"
  );
  if (!user) throw new ApiError(400, "Invalid or expired token");
  if (
    !user.VerificationTokenExpiresAt ||
    user.VerificationTokenExpiresAt.getTime() < Date.now()
  ) {
    throw new ApiError(400, "Token expired. Please request a new verification email.");
  }

  user.EmailVerifiedAt = new Date();
  user.Status = UserStatus.ACTIVE;
  user.VerificationTokenHash = null;
  user.VerificationTokenExpiresAt = null;
  await user.save();

  res.json({ success: true, message: "Email verified", data: { user: toUserDTO(user) } });
}

/**
 * POST /api/auth/resend-verification
 * Body: { email }
 */
export async function resendVerification(req, res) {
  const { email } = req.body ?? {};
  if (!email) throw new ApiError(400, "Email is required");

  const user = await User.findOne({ Email: email.toLowerCase() });
  // Trả về 200 để không leak việc email có tồn tại hay không.
  if (!user || user.Status !== UserStatus.PENDING_VERIFY) {
    return res.json({ success: true, message: "If the email exists, a verification link has been sent." });
  }

  const { raw, hash } = generateToken();
  user.VerificationTokenHash = hash;
  user.VerificationTokenExpiresAt = expiresIn(TOKEN_TTL.EMAIL_VERIFY);
  await user.save();

  await sendVerificationEmail(user, raw).catch((err) =>
    logger.error("[resendVerification] failed", err)
  );

  res.json({ success: true, message: "Verification email sent." });
}

/**
 * POST /api/auth/login
 */
export async function login(req, res) {
  const { Email, Password } = req.body ?? {};
  if (!Email || !Password) throw new ApiError(400, "Email and Password are required");

  const user = await User.findOne({ Email: Email.toLowerCase() }).select("+PasswordHash");
  if (!user || !user.IsActive) throw new ApiError(401, "Invalid credentials");

  const ok = await user.verifyPassword(Password);
  if (!ok) throw new ApiError(401, "Invalid credentials");

  if (user.Status === UserStatus.LOCKED) throw new ApiError(403, "Account is locked");
  if (user.Status === UserStatus.PENDING_VERIFY) {
    throw new ApiError(403, "Please verify your email before logging in.");
  }
  if (user.Status === UserStatus.PENDING_INVITE) {
    throw new ApiError(403, "Please accept your invitation to set a password first.");
  }

  user.LastLoginAt = new Date();
  await user.save();

  const accessToken  = signToken(user);
  const refreshToken = signRefreshToken(user);

  // Trả cả 2 token — học từ Abivin
  res.json({
    success: true,
    data: {
      token:        accessToken,
      refreshToken: refreshToken,
      user: toUserDTO(user)
    }
  });
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 */
export async function forgotPassword(req, res) {
  const { email } = req.body ?? {};
  if (!email) throw new ApiError(400, "Email is required");

  const emailLower = email.toLowerCase();
  const masked = maskEmail(emailLower);
  const user = await User.findOne({ Email: emailLower });

  if (!user || !user.IsActive || user.Status !== UserStatus.ACTIVE) {
    return res.json({ success: true, message: `Nếu email tồn tại, link đặt lại đã được gửi tới ${masked}.` });
  }

  const { raw, hash } = generateToken();
  user.ResetTokenHash = hash;
  user.ResetTokenExpiresAt = expiresIn(TOKEN_TTL.PASSWORD_RESET);
  await user.save();

  await sendResetPasswordEmail(user, raw).catch((err) =>
    logger.error("[forgotPassword] failed", err)
  );

  res.json({ success: true, message: `Link đặt lại mật khẩu đã được gửi tới ${masked}. Kiểm tra hộp thư (và thư mục spam).` });
}

/** abc.def@gmail.com → ab***@gmail.com */
function maskEmail(email) {
  const [local, domain] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 */
export async function resetPassword(req, res) {
  const { token, password } = req.body ?? {};
  if (!token || !password) throw new ApiError(400, "Token and password are required");
  if (password.length < 6) throw new ApiError(400, "Password must be at least 6 characters");

  const tokenHash = hashToken(token);
  const user = await User.findOne({ ResetTokenHash: tokenHash }).select(
    "+ResetTokenHash +ResetTokenExpiresAt"
  );
  if (!user) throw new ApiError(400, "Invalid or expired token");
  if (!user.ResetTokenExpiresAt || user.ResetTokenExpiresAt.getTime() < Date.now()) {
    throw new ApiError(400, "Token expired. Please request a new reset link.");
  }

  user.PasswordHash = await User.hashPassword(password);
  user.ResetTokenHash = null;
  user.ResetTokenExpiresAt = null;
  await user.save();

  res.json({ success: true, message: "Password reset successful. You can log in now." });
}

/**
 * POST /api/auth/accept-invitation
 * Body: { token, password, fullName?, phone? }
 *
 * Khi admin "invite" user, hệ thống tạo User với Status=PENDING_INVITE và không có PasswordHash.
 * Người dùng vào link → đặt password → Status chuyển ACTIVE và EmailVerifiedAt được set.
 */
export async function acceptInvitation(req, res) {
  const { token, password, fullName, phone } = req.body ?? {};
  if (!token || !password) throw new ApiError(400, "Token and password are required");
  if (password.length < 6) throw new ApiError(400, "Password must be at least 6 characters");

  const tokenHash = hashToken(token);
  const user = await User.findOne({ InvitationTokenHash: tokenHash }).select(
    "+InvitationTokenHash +InvitationTokenExpiresAt"
  );
  if (!user) throw new ApiError(400, "Invalid or expired invitation");
  if (
    !user.InvitationTokenExpiresAt ||
    user.InvitationTokenExpiresAt.getTime() < Date.now()
  ) {
    throw new ApiError(400, "Invitation expired. Ask your admin to re-invite.");
  }

  user.PasswordHash = await User.hashPassword(password);
  if (fullName !== undefined) user.FullName = fullName;
  if (phone !== undefined) user.Phone = phone;
  user.EmailVerifiedAt = new Date();
  user.Status = UserStatus.ACTIVE;
  user.InvitationTokenHash = null;
  user.InvitationTokenExpiresAt = null;
  await user.save();

  const jwtToken = signToken(user);
  const rfToken   = signRefreshToken(user);
  res.json({
    success: true,
    message: "Invitation accepted. You are now logged in.",
    data: { token: jwtToken, refreshToken: rfToken, user: toUserDTO(user) }
  });
}

/**
 * GET /api/auth/me
 */
export async function me(req, res) {
  res.json({
    success: true,
    data: {
      user: toUserDTO(req.user),
      role: req.role
        ? {
            _id: req.role._id,
            XCode: req.role.XCode,
            XName: req.role.XName,
            Kind: req.role.Kind,
            Permissions: req.role.Permissions,
            OrganizationID: req.role.OrganizationID
          }
        : null
    }
  });
}

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }
 *
 * Học từ Abivin: auto-refresh JWT khi hết hạn
 * mà không cần login lại.
 */
export async function refresh(req, res) {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) throw new ApiError(400, "refreshToken is required");

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  // Check refresh token blacklist
  const { isBlacklisted } = await import("../models/TokenBlacklist.js");
  if (payload.jti) {
    const blocked = await isBlacklisted(payload.jti, "refresh");
    if (blocked) throw new ApiError(401, "Refresh token has been revoked.");
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.IsActive) throw new ApiError(401, "User not found or inactive");
  if (user.Status !== UserStatus.ACTIVE) throw new ApiError(403, "Account is not active");

  // Thu hồi refresh token cũ — mỗi lần refresh cấp một cặp token mới (rotation)
  if (payload.jti && payload.exp) {
    await blacklistToken(payload.jti, "refresh", new Date(payload.exp * 1000), user._id);
  }

  const newAccessToken  = signToken(user);
  const newRefreshToken = signRefreshToken(user);

  res.json({
    success: true,
    data: { token: newAccessToken, refreshToken: newRefreshToken }
  });
}

/**
 * POST /api/auth/logout
 *
 * Học từ Abivin: đưa cả access token và refresh token vào blacklist
 * → logout tức thì dù JWT chưa hết hạn.
 */
export async function logout(req, res) {
  // req.jwtPayload được set bởi middleware authenticate
  const { jti, exp } = req.jwtPayload ?? {};

  if (jti) {
    await blacklistToken(jti, "access", new Date((exp ?? 0) * 1000), req.user._id);
  }

  // Blacklist refresh token nếu client gửi kèm
  const { refreshToken } = req.body ?? {};
  if (refreshToken) {
    try {
      const rfPayload = verifyRefreshToken(refreshToken);
      if (rfPayload.jti && rfPayload.exp) {
        await blacklistToken(
          rfPayload.jti, "refresh",
          new Date(rfPayload.exp * 1000),
          req.user._id
        );
      }
    } catch { /* refresh token đã hết hạn thì không cần blacklist */ }
  }

  res.json({ success: true, message: "Logged out successfully" });
}

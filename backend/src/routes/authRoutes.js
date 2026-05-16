import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { authRateLimiter, strictAuthRateLimiter } from "../middlewares/rateLimit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as auth from "../controllers/authController.js";

export const authRouter = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng ký tài khoản chủ tổ chức mới (multi-tenant)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [Email, Password, FullName, OrganizationName]
 *             properties:
 *               Email: { type: string, format: email }
 *               Password: { type: string, minLength: 8 }
 *               FullName: { type: string }
 *               OrganizationName: { type: string }
 *     responses:
 *       201: { description: Tạo tổ chức + user thành công }
 *       400: { description: Validation lỗi }
 */
authRouter.post("/register", strictAuthRateLimiter, asyncHandler(auth.register));

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng nhập, trả JWT access + refresh token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [Email, Password]
 *             properties:
 *               Email: { type: string, format: email }
 *               Password: { type: string }
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken: { type: string }
 *                     refreshToken: { type: string }
 *                     user: { type: object }
 *       401: { description: Sai email hoặc mật khẩu }
 */
authRouter.post("/login", authRateLimiter, asyncHandler(auth.login));

authRouter.post("/verify-email", authRateLimiter, asyncHandler(auth.verifyEmail));
authRouter.post(
  "/resend-verification",
  strictAuthRateLimiter,
  asyncHandler(auth.resendVerification)
);

authRouter.post(
  "/forgot-password",
  strictAuthRateLimiter,
  asyncHandler(auth.forgotPassword)
);
authRouter.post("/reset-password", authRateLimiter, asyncHandler(auth.resetPassword));

authRouter.post(
  "/accept-invitation",
  authRateLimiter,
  asyncHandler(auth.acceptInvitation)
);

// Học từ Abivin: auto-refresh access token bằng refresh token
authRouter.post("/refresh", authRateLimiter, asyncHandler(auth.refresh));

authRouter.post("/logout", authenticate, asyncHandler(auth.logout));

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Lấy thông tin user hiện tại (theo JWT)
 *     responses:
 *       200: { description: Trả về user + danh sách Organization }
 *       401: { description: Token không hợp lệ }
 */
authRouter.get("/me", authenticate, asyncHandler(auth.me));

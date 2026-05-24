import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import { sendEmail } from "../services/emailService.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * POST /api/public/contact
 * Form liên hệ ở trang Login — gửi email cho team sales/admin.
 *
 * Body:
 *   fullName, email, phone?, company?, fleetSize?, message, hp? (honeypot)
 *
 * Bảo vệ:
 *   - Rate-limit (5 req / 10 phút / IP) ở route layer.
 *   - Honeypot `hp` — bot sẽ điền field này, trả 200 silent (không gửi email).
 *   - Validate độ dài + email format.
 */
export async function submitContact(req, res) {
  // Honeypot: nếu có giá trị → silently accept (bot không biết)
  if (typeof req.body?.hp === "string" && req.body.hp.trim().length > 0) {
    return res.json({ success: true });
  }

  const fullName = String(req.body?.fullName ?? "").trim().slice(0, 80);
  const email = String(req.body?.email ?? "").trim().toLowerCase().slice(0, 120);
  const phone = String(req.body?.phone ?? "").trim().slice(0, 30);
  const company = String(req.body?.company ?? "").trim().slice(0, 120);
  const fleetSize = String(req.body?.fleetSize ?? "").trim().slice(0, 40);
  const messageBody = String(req.body?.message ?? "").trim().slice(0, 2000);

  if (!fullName) throw new ApiError(400, "Vui lòng nhập họ tên");
  if (!isValidEmail(email)) throw new ApiError(400, "Email không hợp lệ");
  if (!messageBody || messageBody.length < 5) throw new ApiError(400, "Vui lòng nhập lời nhắn");

  const submittedAt = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";

  const text = `LIÊN HỆ MỚI từ trang đăng nhập Road Freight TMS
Thời gian: ${submittedAt}
IP: ${ip}

Họ tên : ${fullName}
Email  : ${email}
SĐT    : ${phone || "(không có)"}
Công ty: ${company || "(không có)"}
Đội xe : ${fleetSize || "(không có)"}

Lời nhắn:
${messageBody}

>> Reply trực tiếp email này để liên hệ lại khách hàng.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px;">
      <h2 style="color: #4f46e5; margin-bottom: 4px;">📞 Liên hệ mới — Road Freight TMS</h2>
      <p style="color: #64748b; font-size: 12px; margin-top: 0;">${escapeHtml(submittedAt)} · IP: <code>${escapeHtml(ip)}</code></p>
      <table style="border-collapse: collapse; margin: 12px 0;">
        <tr><td style="padding: 4px 12px 4px 0; color: #475569;"><b>Họ tên</b></td><td>${escapeHtml(fullName)}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #475569;"><b>Email</b></td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #475569;"><b>SĐT</b></td><td>${escapeHtml(phone) || "<i>(không có)</i>"}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #475569;"><b>Công ty</b></td><td>${escapeHtml(company) || "<i>(không có)</i>"}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #475569;"><b>Quy mô đội xe</b></td><td>${escapeHtml(fleetSize) || "<i>(không có)</i>"}</td></tr>
      </table>
      <h3 style="color: #1e293b; margin-bottom: 4px;">Lời nhắn</h3>
      <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; white-space: pre-wrap;">${escapeHtml(messageBody)}</div>
      <p style="margin-top: 16px; padding: 10px; background: #eef2ff; border-radius: 6px; color: #4338ca; font-size: 13px;">
        📩 Bấm <b>Reply</b> trên email này để trả lời trực tiếp tới khách hàng (đã set Reply-To = email khách).
      </p>
    </div>
  `;

  try {
    await sendEmail({
      to: env.supportEmail,
      replyTo: email,
      subject: `[Road Freight TMS] Liên hệ mới: ${fullName}${company ? ` (${company})` : ""}`,
      text,
      html
    });
  } catch (err) {
    console.warn("[contact] sendEmail failed:", err.message);
    throw new ApiError(502, "Không gửi được liên hệ. Vui lòng thử lại sau.");
  }

  res.json({ success: true, data: { message: "Đã gửi liên hệ. Chúng tôi sẽ phản hồi sớm nhất." } });
}

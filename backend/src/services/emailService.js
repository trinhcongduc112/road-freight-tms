import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let cachedTransport = null;

async function getTransport() {
  if (cachedTransport) return cachedTransport;
  if (!env.smtpHost) return null;
  const { default: nodemailer } = await import("nodemailer");
  cachedTransport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined
  });
  return cachedTransport;
}

function writeDevEmail({ to, subject, html, text }) {
  const dir = path.resolve(process.cwd(), "tmp", "emails");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeSubject = subject.replace(/[^a-z0-9]+/gi, "_").slice(0, 60);
  const file = path.join(dir, `${stamp}__${safeSubject}.html`);
  const body =
    `<!doctype html><meta charset="utf-8"><title>${subject}</title>` +
    `<p><b>To:</b> ${to}</p><p><b>Subject:</b> ${subject}</p><hr/>` +
    `${html ?? `<pre>${text ?? ""}</pre>`}`;
  fs.writeFileSync(file, body);
  return file;
}

export async function sendEmail({ to, subject, html, text, replyTo, headers }) {
  const transport = await getTransport();
  if (!transport) {
    const file = writeDevEmail({ to, subject, html, text });
    logger.info(`[email] (dev) → ${to} | ${subject}`);
    logger.info(`[email] saved to ${file}`);
    return { mocked: true, file };
  }
  const info = await transport.sendMail({ from: env.smtpFrom, to, subject, html, text, replyTo, headers });
  logger.info(`[email] sent → ${to} | id=${info.messageId}`);
  return { mocked: false, messageId: info.messageId };
}

// ─── HTML template ────────────────────────────────────────────────────────────

function buildLink(pathname, token) {
  const base = env.frontendUrl.replace(/\/$/, "");
  return `${base}${pathname}?token=${encodeURIComponent(token)}`;
}

/**
 * Base email wrapper — navy header, white body, footer
 */
function baseTemplate({ title, preheader, bodyHtml }) {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<!-- preheader (hidden) -->
<span style="display:none;font-size:1px;color:#f1f5f9;max-height:0;overflow:hidden;">${preheader}</span>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#1e3a8a,#2563eb);border-radius:12px 12px 0 0;padding:28px 36px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.3px;">
            🚛 Road Freight TMS
          </p>
          <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.65);letter-spacing:0.6px;text-transform:uppercase;">
            Nền tảng quản lý vận tải đường bộ
          </p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="background:#fff;padding:36px 36px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
          ${bodyHtml}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:18px 36px;text-align:center;">
          <p style="margin:0;font-size:11.5px;color:#94a3b8;line-height:1.6;">
            Email này được gửi tự động từ hệ thống Road Freight TMS.<br/>
            Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function ctaButton(href, label) {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background:linear-gradient(135deg,#1e3a8a,#2563eb);border-radius:8px;">
          <a href="${href}"
             style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;letter-spacing:0.5px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

function fallbackLink(href) {
  return `<p style="font-size:12px;color:#94a3b8;word-break:break-all;margin-top:4px;">
    Hoặc copy link này vào trình duyệt:<br/>
    <a href="${href}" style="color:#2563eb;">${href}</a>
  </p>`;
}

// ─── Email senders ─────────────────────────────────────────────────────────────

export async function sendVerificationEmail(user, rawToken) {
  const link = buildLink("/verify-email", rawToken);
  const name = user.FullName || user.UserName;

  return sendEmail({
    to: user.Email,
    subject: "[Road Freight TMS] Xác thực email đăng ký",
    html: baseTemplate({
      title: "Xác thực email",
      preheader: `Xin chào ${name}, nhấn vào link để kích hoạt tài khoản của bạn.`,
      bodyHtml: `
        <h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Xác thực email của bạn</h2>
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          Xin chào <strong>${name}</strong>,<br/>
          Cảm ơn bạn đã đăng ký Road Freight TMS. Nhấn vào nút bên dưới để kích hoạt tài khoản.
        </p>
        ${ctaButton(link, "Kích hoạt tài khoản")}
        ${fallbackLink(link)}
        <hr style="border:none;border-top:1px solid #f1f5f9;margin:20px 0 16px;"/>
        <p style="margin:0;font-size:12.5px;color:#64748b;">
          ⏱ Link có hiệu lực trong <strong>24 giờ</strong>.
        </p>`
    })
  });
}

export async function sendResetPasswordEmail(user, rawToken) {
  const link = buildLink("/reset-password", rawToken);
  const name = user.FullName || user.UserName;

  return sendEmail({
    to: user.Email,
    subject: "[Road Freight TMS] Đặt lại mật khẩu",
    html: baseTemplate({
      title: "Đặt lại mật khẩu",
      preheader: `Có yêu cầu đặt lại mật khẩu cho tài khoản ${user.Email}.`,
      bodyHtml: `
        <h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Đặt lại mật khẩu</h2>
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          Xin chào <strong>${name}</strong>,<br/>
          Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>${user.Email}</strong>.
          Nhấn vào nút bên dưới để tiếp tục.
        </p>
        ${ctaButton(link, "Đặt lại mật khẩu")}
        ${fallbackLink(link)}
        <hr style="border:none;border-top:1px solid #f1f5f9;margin:20px 0 16px;"/>
        <p style="margin:0;font-size:12.5px;color:#64748b;">
          ⏱ Link có hiệu lực trong <strong>1 giờ</strong>.<br/>
          🔒 Nếu bạn không thực hiện yêu cầu này, tài khoản của bạn vẫn an toàn.
        </p>`
    })
  });
}

export async function sendInvitationEmail(user, rawToken, inviter) {
  const link = buildLink("/accept-invitation", rawToken);
  const name = user.FullName || user.UserName;
  const inviterName = inviter?.FullName || inviter?.UserName || "Quản trị viên";

  return sendEmail({
    to: user.Email,
    subject: "[Road Freight TMS] Lời mời tham gia hệ thống",
    html: baseTemplate({
      title: "Lời mời tham gia",
      preheader: `${inviterName} đã mời bạn tham gia Road Freight TMS.`,
      bodyHtml: `
        <h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Bạn được mời tham gia</h2>
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          Xin chào <strong>${name}</strong>,<br/>
          <strong>${inviterName}</strong> đã mời bạn tham gia hệ thống Road Freight TMS
          với tài khoản: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${user.UserName}</code>
        </p>
        ${ctaButton(link, "Nhận lời mời & Đặt mật khẩu")}
        ${fallbackLink(link)}
        <hr style="border:none;border-top:1px solid #f1f5f9;margin:20px 0 16px;"/>
        <p style="margin:0;font-size:12.5px;color:#64748b;">
          ⏱ Link có hiệu lực trong <strong>7 ngày</strong>.
        </p>`
    })
  });
}

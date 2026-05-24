import { TruckFilled } from "@ant-design/icons";

/**
 * Wrapper chung cho các trang Auth (Register, ForgotPassword, ResetPassword,
 * VerifyEmail, AcceptInvitation) — đồng nhất design với LoginPage.
 *
 * Dùng lại bộ CSS .lp-* trong src/styles/global.css.
 *
 *   <AuthShell title="Quên mật khẩu" subtitle="...">
 *     <Form>...</Form>
 *   </AuthShell>
 */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="lp-shell">
      <div className="lp-overlay" />

      <header className="lp-header">
        <div className="lp-brand">
          <div className="lp-brand-icon"><TruckFilled /></div>
          <span className="lp-brand-name">Road Freight TMS</span>
        </div>
      </header>

      <main className="lp-center">
        <div className="lp-card">
          {(title || subtitle) && (
            <div className="lp-card-hd">
              {title && <h2 className="lp-card-title">{title}</h2>}
              {subtitle && <p className="lp-card-sub">{subtitle}</p>}
            </div>
          )}
          {children}
        </div>
      </main>

      {footer && <footer className="lp-footer">{footer}</footer>}
    </div>
  );
}

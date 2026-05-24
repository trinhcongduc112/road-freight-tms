import { TruckFilled } from "@ant-design/icons";
import { Dropdown } from "antd";
import { languages, useLanguage } from "../../i18n.jsx";

/**
 * Wrapper chung cho các trang Auth (Register, ForgotPassword, ResetPassword,
 * VerifyEmail, AcceptInvitation) — đồng nhất design với LoginPage.
 *
 * Dùng lại bộ CSS .lp-* trong src/styles/global.css.
 * Có sẵn nút chuyển ngôn ngữ EN/VI ở footer.
 */
export default function AuthShell({ title, subtitle, children, footer }) {
  const { language, setLanguage } = useLanguage();
  const languageMenuItems = languages.map((item) => ({
    key: item.code,
    label: item.label,
    onClick: () => setLanguage(item.code)
  }));
  const currentLanguage = languages.find((item) => item.code === language) ?? languages[0];

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

      <footer className="lp-footer">
        <Dropdown menu={{ items: languageMenuItems, selectedKeys: [language] }} placement="top" trigger={["click"]}>
          <button className="lp-language-toggle" type="button" aria-label="Language">
            {currentLanguage.shortLabel}
          </button>
        </Dropdown>
        {footer}
      </footer>
    </div>
  );
}

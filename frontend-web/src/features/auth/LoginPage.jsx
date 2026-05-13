import {
  LockOutlined,
  MailOutlined,
  TruckFilled,
  WarningFilled
} from "@ant-design/icons";
import { App, Button, Checkbox, Dropdown, Form, Input, AutoComplete } from "antd"; // Đã thêm AutoComplete
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../../api/auth";
import { languages, useLanguage } from "../../i18n.jsx";
import { useAuthStore } from "../../store/authStore";

function friendlyError(rawMsg = "", t) {
  const m = rawMsg.toLowerCase();
  if (m.includes("password") || m.includes("incorrect") || m.includes("invalid"))
    return t("auth.error.password");
  if (m.includes("not found") || m.includes("email"))
    return t("auth.error.email");
  if (m.includes("locked") || m.includes("disabled"))
    return t("auth.error.locked");
  if (m.includes("network") || m.includes("fetch"))
    return t("auth.error.network");
  return rawMsg || t("auth.error.default");
}

export default function LoginPage() {
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [form]                  = Form.useForm();
  const navigate                = useNavigate();
  const location                = useLocation();
  const setSession              = useAuthStore((s) => s.setSession);
  const { message }             = App.useApp();
  const { language, setLanguage, t } = useLanguage();

  // State chứa danh sách tài khoản đã lưu
  const [savedAccounts, setSavedAccounts] = useState([]);

  const from = location.state?.from?.pathname || "/";

  // Khi vừa mở trang, lôi danh sách tài khoản từ bộ nhớ ra
  useEffect(() => {
    try {
      const accounts = JSON.parse(localStorage.getItem("tms_saved_accounts") || "[]");
      setSavedAccounts(accounts);
    } catch (e) {}
  }, []);

  // Hàm tự động điền mật khẩu khi người dùng chọn 1 email từ danh sách xổ xuống
  const onSelectEmail = (value) => {
    const acc = savedAccounts.find(a => a.Email === value);
    if (acc) {
      form.setFieldsValue({ Password: acc.Password, remember: true });
      setErrorMsg("");
    }
  };

  const onSubmit = async (values) => {
    setErrorMsg("");

    // Lưu tài khoản vào danh sách nếu có tích "Ghi nhớ"
    if (values.remember) {
      let accounts = [...savedAccounts];
      // Xóa cái cũ đi (nếu trùng email) để cập nhật mật khẩu mới lên đầu
      accounts = accounts.filter(a => a.Email !== values.Email);
      accounts.unshift({ Email: values.Email, Password: values.Password });
      localStorage.setItem("tms_saved_accounts", JSON.stringify(accounts));
      setSavedAccounts(accounts);
    }

    try {
      setLoading(true);
      const res = await authApi.login(values);
      const { token, refreshToken, user } = res.data;
      const meRes = await (async () => {
        useAuthStore.getState().setSession({ token, refreshToken, user, role: null });
        return authApi.me();
      })();
      setSession({ token, refreshToken, user, role: meRes.data.role });
      message.success(t("auth.login.welcome", { name: user.FullName || user.UserName }));
      navigate(from, { replace: true });
    } catch (err) {
      setErrorMsg(friendlyError(err.message, t));
    } finally {
      setLoading(false);
    }
  };
  const languageMenuItems = languages.map((item) => ({
    key: item.code,
    label: item.label,
    onClick: () => setLanguage(item.code)
  }));
  const currentLanguage = languages.find((item) => item.code === language) ?? languages[0];

  return (
    <div className="lp-shell">
      {/* Cinematic overlay */}
      <div className="lp-overlay" />

      {/* Brand — top left */}
      <header className="lp-header">
        <div className="lp-brand">
          <div className="lp-brand-icon"><TruckFilled /></div>
          <span className="lp-brand-name">Road Freight TMS</span>
        </div>
      </header>

      {/* Centered login card */}
      <main className="lp-center">
        <div className="lp-card">

          <div className="lp-card-hd">
            <h2 className="lp-card-title">{t("auth.login.title")}</h2>
            <p className="lp-card-sub">{t("auth.login.subtitle")}</p>
          </div>

          {errorMsg && (
            <div className="lp-err">
              <WarningFilled className="lp-err-icon" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false} size="large">

            <Form.Item
              label="Email"
              name="Email"
              rules={[
                { required: true, message: t("auth.login.emailRequired") },
                { type: "email",  message: t("auth.login.emailInvalid") }
              ]}
            >
              {/* Thay vì dùng Input thường, ta dùng AutoComplete để tạo menu xổ xuống */}
              <AutoComplete
                options={savedAccounts.map(a => ({ value: a.Email }))}
                onSelect={onSelectEmail}
                onChange={() => errorMsg && setErrorMsg("")}
              >
                <Input
                  prefix={<MailOutlined className="lp-icon" />}
                  placeholder="admin@company.com"
                  className="lp-inp"
                />
              </AutoComplete>
            </Form.Item>

            <Form.Item
              label={t("auth.login.password")}
              name="Password"
              rules={[{ required: true, message: t("auth.login.passwordRequired") }]}
              style={{ marginBottom: 12 }}
            >
              <Input.Password
                prefix={<LockOutlined className="lp-icon" />}
                placeholder="••••••••"
                className="lp-inp"
                onChange={() => errorMsg && setErrorMsg("")}
              />
            </Form.Item>

            <div className="lp-row-util">
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox className="lp-ck">{t("auth.login.remember")}</Checkbox>
              </Form.Item>
              <Link to="/forgot-password" className="lp-lnk">{t("auth.login.forgotPassword")}</Link>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              className="lp-submit"
            >
              {loading ? t("auth.login.loading") : t("auth.login.submit")}
            </Button>

            <p className="lp-register">
              {t("auth.login.registerText")}{" "}
              <Link to="/register" className="lp-lnk lp-lnk--bold">{t("auth.login.registerLink")}</Link>
            </p>
          </Form>

        </div>
      </main>

      {/* Bottom tagline */}
      <footer className="lp-footer">
        <Dropdown menu={{ items: languageMenuItems, selectedKeys: [language] }} placement="top" trigger={["click"]}>
          <button className="lp-language-toggle" type="button" aria-label={t("common.language")}>
            {currentLanguage.shortLabel}
          </button>
        </Dropdown>
        <span>{t("auth.login.footer")}</span>
      </footer>
    </div>
  );
}

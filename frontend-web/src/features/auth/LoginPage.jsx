import {
  LockOutlined,
  MailOutlined,
  TruckFilled,
  WarningFilled
} from "@ant-design/icons";
import { App, Button, Checkbox, Form, Input } from "antd";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";


function friendlyError(rawMsg = "") {
  const m = rawMsg.toLowerCase();
  if (m.includes("password") || m.includes("incorrect") || m.includes("invalid"))
    return "Mật khẩu không đúng. Vui lòng kiểm tra lại.";
  if (m.includes("not found") || m.includes("email"))
    return "Email chưa được đăng ký trong hệ thống.";
  if (m.includes("locked") || m.includes("disabled"))
    return "Tài khoản đã bị khoá. Liên hệ quản trị viên.";
  if (m.includes("network") || m.includes("fetch"))
    return "Không kết nối được máy chủ. Kiểm tra kết nối mạng.";
  return rawMsg || "Đăng nhập thất bại. Vui lòng thử lại.";
}

export default function LoginPage() {
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [form]                  = Form.useForm();
  const navigate                = useNavigate();
  const location                = useLocation();
  const setSession              = useAuthStore((s) => s.setSession);
  const { message }             = App.useApp();

  const from = location.state?.from?.pathname || "/";

  const onSubmit = async (values) => {
    setErrorMsg("");
    try {
      setLoading(true);
      const res = await authApi.login(values);
      const { token, refreshToken, user } = res.data;
      const meRes = await (async () => {
        useAuthStore.getState().setSession({ token, refreshToken, user, role: null });
        return authApi.me();
      })();
      setSession({ token, refreshToken, user, role: meRes.data.role });
      message.success(`Xin chào, ${user.FullName || user.UserName}!`);
      navigate(from, { replace: true });
    } catch (err) {
      setErrorMsg(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };


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
            <h2 className="lp-card-title">Đăng nhập</h2>
            <p className="lp-card-sub">Nhập thông tin tài khoản để tiếp tục</p>
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
                { required: true, message: "Vui lòng nhập email" },
                { type: "email",  message: "Email không hợp lệ" }
              ]}
            >
              <Input
                prefix={<MailOutlined className="lp-icon" />}
                placeholder="admin@company.com"
                autoComplete="email"
                className="lp-inp"
                onChange={() => errorMsg && setErrorMsg("")}
              />
            </Form.Item>

            <Form.Item
              label="Mật khẩu"
              name="Password"
              rules={[{ required: true, message: "Vui lòng nhập mật khẩu" }]}
              style={{ marginBottom: 12 }}
            >
              <Input.Password
                prefix={<LockOutlined className="lp-icon" />}
                placeholder="••••••••"
                autoComplete="current-password"
                className="lp-inp"
                onChange={() => errorMsg && setErrorMsg("")}
              />
            </Form.Item>

            <div className="lp-row-util">
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox className="lp-ck">Ghi nhớ đăng nhập</Checkbox>
              </Form.Item>
              <Link to="/forgot-password" className="lp-lnk">Quên mật khẩu?</Link>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              className="lp-submit"
            >
              {loading ? "Đang xác thực..." : "ĐĂNG NHẬP"}
            </Button>

            <p className="lp-register">
              Chưa có tổ chức?{" "}
              <Link to="/register" className="lp-lnk lp-lnk--bold">Đăng ký ngay</Link>
            </p>
          </Form>


        </div>
      </main>

      {/* Bottom tagline */}
      <footer className="lp-footer">
        Nền tảng quản lý vận tải đường bộ · GPS thời gian thực · Phân tuyến thông minh
      </footer>
    </div>
  );
}

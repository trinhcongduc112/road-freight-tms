import { TruckFilled } from "@ant-design/icons";
import { Alert, App, Button, Form, Input, Progress, Typography } from "antd";
import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../api/auth";

const { Title, Text } = Typography;

const RULES = [
  { label: "Chứa chữ hoa", test: (p) => /[A-Z]/.test(p) },
  { label: "Chứa chữ thường", test: (p) => /[a-z]/.test(p) },
  { label: "Chứa số", test: (p) => /\d/.test(p) },
  { label: "Chứa ký tự đặc biệt", test: (p) => /[^A-Za-z\d]/.test(p) },
  { label: "Tối thiểu 8 ký tự", test: (p) => p.length >= 8 }
];

function PasswordStrength({ password }) {
  if (!password) return null;
  const passed = RULES.filter((r) => r.test(password)).length;
  const percent = Math.round((passed / RULES.length) * 100);
  const color = percent < 40 ? "#ff4d4f" : percent < 80 ? "#faad14" : "#52c41a";

  return (
    <div style={{ marginTop: -8, marginBottom: 8 }}>
      <Progress percent={percent} strokeColor={color} showInfo={false} size="small" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px", marginTop: 4 }}>
        {RULES.map((r) => {
          const ok = r.test(password);
          return (
            <Text key={r.label} style={{ fontSize: 12, color: ok ? "#52c41a" : "#8c8c8c" }}>
              {ok ? "✓" : "○"} {r.label}
            </Text>
          );
        })}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);
  const [devLink, setDevLink] = useState(null);
  const password = Form.useWatch("Password", form) ?? "";

  const onSubmit = async (values) => {
    try {
      setLoading(true);
      const res = await authApi.register({
        CompanyName: values.CompanyName,
        Email: values.Email,
        FullName: values.FullName,
        Phone: values.Phone,
        Password: values.Password
      });
      if (res?.devVerifyLink) setDevLink(res.devVerifyLink);
      setDone(values.Email);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: "#1677ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 8, padding: "40px 48px", width: 440, textAlign: "center" }}>
          <TruckFilled style={{ fontSize: 40, color: "#1677ff" }} />
          <Title level={4} style={{ marginTop: 12 }}>Kiểm tra hộp thư</Title>
          <Alert
            type="success"
            message={`Email xác thực đã gửi tới ${done}`}
            description="Nhấn vào link trong email để kích hoạt tài khoản (hết hạn sau 24 giờ)."
            showIcon
            style={{ marginBottom: 16, textAlign: "left" }}
          />
          {devLink && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16, textAlign: "left" }}
              message="[Dev] Link xác thực"
              description={
                <a href={devLink} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all", fontSize: 12 }}>
                  {devLink}
                </a>
              }
            />
          )}
          <Link to="/login">← Về đăng nhập</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#1677ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 8, padding: "40px 48px", width: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <TruckFilled style={{ fontSize: 40, color: "#1677ff" }} />
          <Title level={3} style={{ marginTop: 8, marginBottom: 0 }}>Road Freight TMS</Title>
        </div>

        <Form form={form} layout="vertical" onFinish={onSubmit} size="large">
          <Form.Item
            name="Email"
            label="Email *"
            rules={[{ required: true, type: "email", message: "Email không hợp lệ" }]}
          >
            <Input placeholder="email@company.vn" />
          </Form.Item>

          <Form.Item
            name="FullName"
            label="Họ và tên *"
            rules={[{ required: true, message: "Bắt buộc" }]}
          >
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>

          <Form.Item
            name="CompanyName"
            label="Tên công ty"
            rules={[{ required: true, message: "Bắt buộc" }]}
          >
            <Input placeholder="Công ty TNHH Vận tải ABC" />
          </Form.Item>

          <Form.Item name="Phone" label="Số điện thoại *" rules={[{ required: true, message: "Bắt buộc" }]}>
            <Input placeholder="0988668668" />
          </Form.Item>

          <Form.Item
            name="Password"
            label="Mật khẩu *"
            rules={[
              { required: true, message: "Bắt buộc" },
              {
                validator(_, value) {
                  if (!value) return Promise.resolve();
                  const passed = RULES.filter((r) => r.test(value)).length;
                  if (passed < RULES.length) return Promise.reject(new Error("Mật khẩu chưa đủ mạnh"));
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>

          <PasswordStrength password={password} />

          <Form.Item
            name="ConfirmPassword"
            label="Xác nhận mật khẩu *"
            dependencies={["Password"]}
            rules={[
              { required: true, message: "Bắt buộc" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("Password") === value) return Promise.resolve();
                  return Promise.reject(new Error("Mật khẩu không khớp"));
                }
              })
            ]}
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 44, fontSize: 15 }}>
              SIGN UP
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: "center" }}>
          <Text type="secondary">Already have an account? </Text>
          <Link to="/login" style={{ fontWeight: 500 }}>Sign In!</Link>
        </div>
      </div>
    </div>
  );
}

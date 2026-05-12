import { TruckFilled } from "@ant-design/icons";
import { Alert, App, Button, Card, Form, Input, Typography } from "antd";
import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../api/auth";

const { Title, Text } = Typography;

export default function ForgotPasswordPage() {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [doneMsg, setDoneMsg] = useState("");

  const onSubmit = async ({ email }) => {
    try {
      setLoading(true);
      const res = await authApi.forgotPassword(email);
      setDoneMsg(res?.message || "Kiểm tra hộp thư của bạn.");
      setDone(true);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell" style={{ background: "#f0f2f5" }}>
      <Card style={{ maxWidth: 420, margin: "100px auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <TruckFilled style={{ fontSize: 28, color: "#1677ff" }} />
          <Title level={4} style={{ marginTop: 8, marginBottom: 4 }}>
            Quên mật khẩu
          </Title>
          <Text type="secondary">
            Nhập email tài khoản — chúng tôi sẽ gửi link đặt lại mật khẩu
          </Text>
        </div>

        {done ? (
          <Alert
            type="success"
            message="Đã gửi"
            description={doneMsg}
            showIcon
            style={{ marginBottom: 16 }}
          />
        ) : (
          <Form form={form} layout="vertical" onFinish={onSubmit}>
            <Form.Item
              name="email"
              label="Email"
              rules={[{ required: true, type: "email", message: "Email không hợp lệ" }]}
            >
              <Input placeholder="email@company.vn" autoFocus />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block loading={loading}>
                Gửi link đặt lại mật khẩu
              </Button>
            </Form.Item>
          </Form>
        )}

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Link to="/login">← Về đăng nhập</Link>
        </div>
      </Card>
    </div>
  );
}

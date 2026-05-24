import { App, Alert, Button, Form, Input } from "antd";
import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../api/auth";
import AuthShell from "./AuthShell";

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
    <AuthShell
      title="Quên mật khẩu"
      subtitle="Nhập email tài khoản — chúng tôi sẽ gửi link đặt lại mật khẩu"
    >
      {done ? (
        <Alert
          type="success"
          message="Đã gửi"
          description={doneMsg}
          showIcon
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false} size="large">
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: "email", message: "Email không hợp lệ" }]}
          >
            <Input className="lp-inp" placeholder="email@company.vn" autoFocus />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading} className="lp-submit">
              Gửi link đặt lại mật khẩu
            </Button>
          </Form.Item>
        </Form>
      )}

      <p className="lp-register">
        <Link to="/login" className="lp-lnk">← Về đăng nhập</Link>
      </p>
    </AuthShell>
  );
}

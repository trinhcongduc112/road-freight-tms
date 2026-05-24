import { App, Button, Form, Input, Result } from "antd";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/auth";
import AuthShell from "./AuthShell";

export default function ResetPasswordPage() {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <AuthShell title="Link không hợp lệ" subtitle="Không tìm thấy token trong URL">
        <Result
          status="error"
          extra={<Link to="/forgot-password"><Button>Yêu cầu link mới</Button></Link>}
        />
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Đặt lại mật khẩu thành công!" subtitle="Bạn có thể đăng nhập với mật khẩu mới">
        <Result
          status="success"
          extra={<Link to="/login"><Button type="primary" className="lp-submit">Đăng nhập</Button></Link>}
        />
      </AuthShell>
    );
  }

  const onSubmit = async ({ password }) => {
    try {
      setLoading(true);
      await authApi.resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Đặt lại mật khẩu" subtitle="Nhập mật khẩu mới cho tài khoản của bạn">
      <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false} size="large">
        <Form.Item
          name="password"
          label="Mật khẩu mới"
          rules={[{ required: true, min: 6, message: "Tối thiểu 6 ký tự" }]}
        >
          <Input.Password className="lp-inp" placeholder="Tối thiểu 6 ký tự" autoFocus />
        </Form.Item>
        <Form.Item
          name="confirm"
          label="Xác nhận mật khẩu"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Bắt buộc" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) return Promise.resolve();
                return Promise.reject(new Error("Mật khẩu không khớp"));
              }
            })
          ]}
        >
          <Input.Password className="lp-inp" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" block loading={loading} className="lp-submit">
            Xác nhận đặt lại
          </Button>
        </Form.Item>
      </Form>

      <p className="lp-register">
        <Link to="/login" className="lp-lnk">← Về đăng nhập</Link>
      </p>
    </AuthShell>
  );
}

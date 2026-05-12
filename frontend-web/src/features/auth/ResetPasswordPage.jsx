import { App, Button, Card, Form, Input, Result, Typography } from "antd";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/auth";

const { Title, Text } = Typography;

export default function ResetPasswordPage() {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div style={{ maxWidth: 420, margin: "100px auto", padding: "0 16px" }}>
        <Result status="error" title="Link không hợp lệ" subTitle="Không tìm thấy token trong URL." extra={<Link to="/forgot-password"><Button>Yêu cầu link mới</Button></Link>} />
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ maxWidth: 420, margin: "100px auto", padding: "0 16px" }}>
        <Result status="success" title="Đặt lại mật khẩu thành công!" subTitle="Bạn có thể đăng nhập với mật khẩu mới." extra={<Link to="/login"><Button type="primary">Đăng nhập</Button></Link>} />
      </div>
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
    <div className="login-shell" style={{ background: "#f0f2f5" }}>
      <Card style={{ maxWidth: 420, margin: "100px auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 4 }}>Đặt lại mật khẩu</Title>
          <Text type="secondary">Nhập mật khẩu mới cho tài khoản của bạn</Text>
        </div>
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item
            name="password"
            label="Mật khẩu mới"
            rules={[{ required: true, min: 6, message: "Tối thiểu 6 ký tự" }]}
          >
            <Input.Password placeholder="Tối thiểu 6 ký tự" autoFocus />
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
            <Input.Password />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Xác nhận đặt lại
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

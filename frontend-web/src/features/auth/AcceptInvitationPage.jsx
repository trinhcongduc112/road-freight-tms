import { App, Button, Card, Form, Input, Result, Typography } from "antd";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";

const { Title, Text } = Typography;

export default function AcceptInvitationPage() {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const setSession = useAuthStore((s) => s.setSession);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div style={{ maxWidth: 420, margin: "100px auto", padding: "0 16px" }}>
        <Result
          status="error"
          title="Link không hợp lệ"
          subTitle="Link lời mời không tìm thấy token. Vui lòng liên hệ quản trị viên."
          extra={<Link to="/login"><Button>Về đăng nhập</Button></Link>}
        />
      </div>
    );
  }

  const onSubmit = async ({ password, fullName, phone }) => {
    try {
      setLoading(true);
      const res = await authApi.acceptInvitation({ token, password, fullName, phone });
      const { token: jwt, refreshToken, user } = res.data ?? res;
      useAuthStore.getState().setSession({ token: jwt, refreshToken, user, role: null });
      const meRes = await authApi.me();
      const role = meRes?.data?.role ?? meRes?.role ?? null;
      setSession({ token: jwt, refreshToken, user, role });
      message.success(`Chào mừng, ${user.UserName}! Tài khoản đã kích hoạt.`);
      navigate("/", { replace: true });
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell" style={{ background: "#f0f2f5" }}>
      <Card style={{ maxWidth: 460, margin: "80px auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 4 }}>Kích hoạt tài khoản</Title>
          <Text type="secondary">
            Bạn được mời tham gia Road Freight TMS. Đặt mật khẩu để bắt đầu.
          </Text>
        </div>
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="fullName" label="Họ và tên (tùy chọn)">
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại (tùy chọn)">
            <Input placeholder="0901234567" />
          </Form.Item>
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
            <Button type="primary" htmlType="submit" block loading={loading} size="large">
              Kích hoạt tài khoản
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

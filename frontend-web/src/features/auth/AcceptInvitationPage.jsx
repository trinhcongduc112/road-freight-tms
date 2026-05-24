import { App, Button, Form, Input, Result } from "antd";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import AuthShell from "./AuthShell";

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
      <AuthShell title="Link không hợp lệ" subtitle="Link lời mời không tìm thấy token">
        <Result
          status="error"
          subTitle="Vui lòng liên hệ quản trị viên."
          extra={<Link to="/login"><Button className="lp-submit">Về đăng nhập</Button></Link>}
        />
      </AuthShell>
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
    <AuthShell
      title="Kích hoạt tài khoản"
      subtitle="Bạn được mời tham gia Road Freight TMS. Đặt mật khẩu để bắt đầu."
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false} size="large">
        <Form.Item name="fullName" label="Họ và tên (tùy chọn)">
          <Input className="lp-inp" placeholder="Nguyễn Văn A" />
        </Form.Item>
        <Form.Item name="phone" label="Số điện thoại (tùy chọn)">
          <Input className="lp-inp" placeholder="0901234567" />
        </Form.Item>
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
            Kích hoạt tài khoản
          </Button>
        </Form.Item>
      </Form>
    </AuthShell>
  );
}

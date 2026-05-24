import { App, Button, Form, Input, Result } from "antd";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { useLanguage } from "../../i18n.jsx";
import AuthShell from "./AuthShell";

export default function AcceptInvitationPage() {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const setSession = useAuthStore((s) => s.setSession);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <AuthShell title={t("auth.common.invalidLink")} subtitle={t("auth.invite.noTokenSub")}>
        <Result
          status="error"
          extra={<Link to="/login"><Button className="lp-submit">{t("auth.invite.backLogin")}</Button></Link>}
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
      message.success(t("auth.invite.welcomeName", { name: user.UserName }));
      navigate("/", { replace: true });
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={t("auth.invite.title")} subtitle={t("auth.invite.subtitle")}>
      <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false} size="large">
        <Form.Item name="fullName" label={t("auth.invite.fullName")}>
          <Input className="lp-inp" />
        </Form.Item>
        <Form.Item name="phone" label={t("auth.invite.phone")}>
          <Input className="lp-inp" />
        </Form.Item>
        <Form.Item
          name="password"
          label={t("auth.invite.password")}
          rules={[{ required: true, min: 6, message: t("auth.reset.minLength") }]}
        >
          <Input.Password className="lp-inp" autoFocus />
        </Form.Item>
        <Form.Item
          name="confirm"
          label={t("auth.invite.confirm")}
          dependencies={["password"]}
          rules={[
            { required: true, message: t("auth.common.required") },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) return Promise.resolve();
                return Promise.reject(new Error(t("auth.reset.notMatch")));
              }
            })
          ]}
        >
          <Input.Password className="lp-inp" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" block loading={loading} className="lp-submit">
            {t("auth.invite.submit")}
          </Button>
        </Form.Item>
      </Form>
    </AuthShell>
  );
}

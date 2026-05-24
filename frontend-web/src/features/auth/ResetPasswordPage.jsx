import { App, Button, Form, Input, Result } from "antd";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/auth";
import { useLanguage } from "../../i18n.jsx";
import AuthShell from "./AuthShell";

export default function ResetPasswordPage() {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <AuthShell title={t("auth.common.invalidLink")} subtitle={t("auth.reset.noToken")}>
        <Result
          status="error"
          extra={<Link to="/forgot-password"><Button>{t("auth.reset.requestNew")}</Button></Link>}
        />
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title={t("auth.reset.doneTitle")} subtitle={t("auth.reset.doneSub")}>
        <Result
          status="success"
          extra={<Link to="/login"><Button type="primary" className="lp-submit">{t("auth.reset.doneLogin")}</Button></Link>}
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
    <AuthShell title={t("auth.reset.title")} subtitle={t("auth.reset.subtitle")}>
      <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false} size="large">
        <Form.Item
          name="password"
          label={t("auth.reset.newPassword")}
          rules={[{ required: true, min: 6, message: t("auth.reset.minLength") }]}
        >
          <Input.Password className="lp-inp" placeholder={t("auth.reset.minLength")} autoFocus />
        </Form.Item>
        <Form.Item
          name="confirm"
          label={t("auth.reset.confirm")}
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
            {t("auth.reset.submit")}
          </Button>
        </Form.Item>
      </Form>

      <p className="lp-register">
        <Link to="/login" className="lp-lnk">{t("auth.common.backToLogin")}</Link>
      </p>
    </AuthShell>
  );
}

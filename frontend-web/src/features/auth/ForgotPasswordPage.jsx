import { App, Alert, Button, Form, Input } from "antd";
import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../api/auth";
import { useLanguage } from "../../i18n.jsx";
import AuthShell from "./AuthShell";

export default function ForgotPasswordPage() {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");

  const onSubmit = async ({ email }) => {
    try {
      setLoading(true);
      const res = await authApi.forgotPassword(email);
      setDoneMsg(res?.message || t("auth.forgot.doneDefault"));
      setDone(true);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={t("auth.forgot.title")} subtitle={t("auth.forgot.subtitle")}>
      {done ? (
        <Alert
          type="success"
          message={t("auth.forgot.doneTitle")}
          description={doneMsg}
          showIcon
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false} size="large">
          <Form.Item
            name="email"
            label={t("auth.common.email")}
            rules={[{ required: true, type: "email", message: t("auth.common.emailInvalid") }]}
          >
            <Input className="lp-inp" placeholder="email@company.vn" autoFocus />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading} className="lp-submit">
              {t("auth.forgot.submit")}
            </Button>
          </Form.Item>
        </Form>
      )}

      <p className="lp-register">
        <Link to="/login" className="lp-lnk">{t("auth.common.backToLogin")}</Link>
      </p>
    </AuthShell>
  );
}

import { Alert, App, Button, Form, Input, Progress, Typography } from "antd";
import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../api/auth";
import { useLanguage } from "../../i18n.jsx";
import AuthShell from "./AuthShell";

const { Text } = Typography;

const RULE_TESTS = [
  { key: "upper",   test: (p) => /[A-Z]/.test(p) },
  { key: "lower",   test: (p) => /[a-z]/.test(p) },
  { key: "digit",   test: (p) => /\d/.test(p) },
  { key: "special", test: (p) => /[^A-Za-z\d]/.test(p) },
  { key: "length",  test: (p) => p.length >= 8 }
];

function PasswordStrength({ password, t }) {
  if (!password) return null;
  const passed = RULE_TESTS.filter((r) => r.test(password)).length;
  const percent = Math.round((passed / RULE_TESTS.length) * 100);
  const color = percent < 40 ? "#ff4d4f" : percent < 80 ? "#faad14" : "#52c41a";

  return (
    <div style={{ marginTop: -8, marginBottom: 8 }}>
      <Progress percent={percent} strokeColor={color} showInfo={false} size="small" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px", marginTop: 4 }}>
        {RULE_TESTS.map((r) => {
          const ok = r.test(password);
          return (
            <Text key={r.key} style={{ fontSize: 12, color: ok ? "#52c41a" : "#8c8c8c" }}>
              {ok ? "✓" : "○"} {t(`auth.register.rule.${r.key}`)}
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
  const { t } = useLanguage();
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
      <AuthShell title={t("auth.register.doneTitle")} subtitle={t("auth.register.doneSub", { email: done })}>
        <Alert
          type="success"
          message={t("auth.register.doneAlertTitle")}
          description={t("auth.register.doneAlertDesc")}
          showIcon
          style={{ marginBottom: 16 }}
        />
        {devLink && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={t("auth.register.devLink")}
            description={
              <a href={devLink} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all", fontSize: 12 }}>
                {devLink}
              </a>
            }
          />
        )}
        <p className="lp-register">
          <Link to="/login" className="lp-lnk">{t("auth.common.backToLogin")}</Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("auth.register.title")} subtitle={t("auth.register.subtitle")}>
      <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false} size="large">
        <Form.Item
          name="Email"
          label={t("auth.common.email")}
          rules={[{ required: true, type: "email", message: t("auth.common.emailInvalid") }]}
        >
          <Input className="lp-inp" placeholder="email@company.vn" />
        </Form.Item>

        <Form.Item
          name="FullName"
          label={t("auth.register.fullName")}
          rules={[{ required: true, message: t("auth.common.required") }]}
        >
          <Input className="lp-inp" />
        </Form.Item>

        <Form.Item
          name="CompanyName"
          label={t("auth.register.company")}
          rules={[{ required: true, message: t("auth.common.required") }]}
        >
          <Input className="lp-inp" />
        </Form.Item>

        <Form.Item name="Phone" label={t("auth.register.phone")} rules={[{ required: true, message: t("auth.common.required") }]}>
          <Input className="lp-inp" placeholder="0988668668" />
        </Form.Item>

        <Form.Item
          name="Password"
          label={t("auth.register.password")}
          rules={[
            { required: true, message: t("auth.common.required") },
            {
              validator(_, value) {
                if (!value) return Promise.resolve();
                const passed = RULE_TESTS.filter((r) => r.test(value)).length;
                if (passed < RULE_TESTS.length) return Promise.reject(new Error(t("auth.register.notStrong")));
                return Promise.resolve();
              }
            }
          ]}
        >
          <Input.Password className="lp-inp" placeholder="••••••••" />
        </Form.Item>

        <PasswordStrength password={password} t={t} />

        <Form.Item
          name="ConfirmPassword"
          label={t("auth.register.confirm")}
          dependencies={["Password"]}
          rules={[
            { required: true, message: t("auth.common.required") },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("Password") === value) return Promise.resolve();
                return Promise.reject(new Error(t("auth.register.notMatch")));
              }
            })
          ]}
        >
          <Input.Password className="lp-inp" placeholder="••••••••" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 12 }}>
          <Button type="primary" htmlType="submit" block loading={loading} className="lp-submit">
            {t("auth.register.submit")}
          </Button>
        </Form.Item>
      </Form>

      <p className="lp-register">
        {t("auth.register.haveAccount")}{" "}
        <Link to="/login" className="lp-lnk lp-lnk--bold">{t("auth.register.signin")}</Link>
      </p>
    </AuthShell>
  );
}

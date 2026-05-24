import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from "@ant-design/icons";
import { Alert, App, Button, Form, Input, Result } from "antd";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/auth";
import { useLanguage } from "../../i18n.jsx";
import AuthShell from "./AuthShell";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const { message } = App.useApp();
  const { t } = useLanguage();
  const token = searchParams.get("token");

  const [state, setState] = useState("idle"); // idle | loading | ok | error
  const [errorMsg, setErrorMsg] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    setState("loading");
    authApi.verifyEmail(token)
      .then(() => setState("ok"))
      .catch((e) => { setState("error"); setErrorMsg(e.message); });
  }, [token]);

  const onResend = async () => {
    if (!resendEmail) return message.warning(t("auth.common.emailInvalid"));
    try {
      setResendLoading(true);
      await authApi.resendVerification(resendEmail);
      setResendDone(true);
    } catch (e) {
      message.error(e.message);
    } finally {
      setResendLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title={t("auth.verify.noTokenTitle")} subtitle={t("auth.verify.noTokenSub")}>
        <Alert type="warning" message={t("auth.verify.noTokenWarn")} showIcon />
        <p className="lp-register">
          <Link to="/login" className="lp-lnk">{t("auth.common.backToLogin")}</Link>
        </p>
      </AuthShell>
    );
  }

  if (state === "loading") {
    return (
      <AuthShell title={t("auth.verify.titleLoading")} subtitle={t("auth.verify.subLoading")}>
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <LoadingOutlined style={{ fontSize: 48, color: "#1677ff" }} />
        </div>
      </AuthShell>
    );
  }

  if (state === "ok") {
    return (
      <AuthShell title={t("auth.verify.titleOk")} subtitle={t("auth.verify.subOk")}>
        <Result
          status="success"
          icon={<CheckCircleOutlined />}
          extra={<Link to="/login"><Button type="primary" className="lp-submit">{t("auth.verify.loginNow")}</Button></Link>}
        />
      </AuthShell>
    );
  }

  if (state === "error") {
    return (
      <AuthShell title={t("auth.verify.titleFail")} subtitle={errorMsg || t("auth.verify.subFail")}>
        <Result
          status="error"
          icon={<CloseCircleOutlined />}
          subTitle={resendDone ? null : t("auth.verify.canResend")}
        />

        {resendDone ? (
          <Alert type="success" message={t("auth.verify.resendDone")} showIcon />
        ) : (
          <Form layout="vertical" onFinish={onResend} size="large">
            <Form.Item label={t("auth.verify.resendLabel")}>
              <Input
                className="lp-inp"
                placeholder="email@company.vn"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                type="email"
              />
            </Form.Item>
            <Button
              type="primary" block htmlType="submit"
              loading={resendLoading} onClick={onResend}
              className="lp-submit"
            >
              {t("auth.verify.resendSubmit")}
            </Button>
          </Form>
        )}

        <p className="lp-register">
          <Link to="/login" className="lp-lnk">{t("auth.common.backToLogin")}</Link>
        </p>
      </AuthShell>
    );
  }

  return null;
}

import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from "@ant-design/icons";
import { Alert, App, Button, Form, Input, Result } from "antd";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/auth";
import AuthShell from "./AuthShell";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const { message } = App.useApp();
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
    if (!resendEmail) return message.warning("Nhập email của bạn");
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
      <AuthShell title="Thiếu token" subtitle="URL xác thực không hợp lệ">
        <Alert type="warning" message="Không có token xác thực trong URL." showIcon />
        <p className="lp-register">
          <Link to="/login" className="lp-lnk">← Về đăng nhập</Link>
        </p>
      </AuthShell>
    );
  }

  if (state === "loading") {
    return (
      <AuthShell title="Đang xác thực email" subtitle="Vui lòng đợi trong giây lát">
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <LoadingOutlined style={{ fontSize: 48, color: "#1677ff" }} />
        </div>
      </AuthShell>
    );
  }

  if (state === "ok") {
    return (
      <AuthShell title="Email đã được xác thực!" subtitle="Tài khoản của bạn đã được kích hoạt">
        <Result
          status="success"
          icon={<CheckCircleOutlined />}
          subTitle="Bạn có thể đăng nhập ngay."
          extra={<Link to="/login"><Button type="primary" className="lp-submit">Đăng nhập ngay</Button></Link>}
        />
      </AuthShell>
    );
  }

  if (state === "error") {
    return (
      <AuthShell title="Xác thực thất bại" subtitle={errorMsg || "Token không hợp lệ hoặc đã hết hạn"}>
        <Result
          status="error"
          icon={<CloseCircleOutlined />}
          subTitle={resendDone ? null : "Bạn có thể gửi lại email xác thực bên dưới."}
        />

        {resendDone ? (
          <Alert type="success" message="Đã gửi lại email xác thực — kiểm tra hộp thư của bạn." showIcon />
        ) : (
          <Form layout="vertical" onFinish={onResend} size="large">
            <Form.Item label="Email đã đăng ký">
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
              Gửi lại email xác thực
            </Button>
          </Form>
        )}

        <p className="lp-register">
          <Link to="/login" className="lp-lnk">← Về đăng nhập</Link>
        </p>
      </AuthShell>
    );
  }

  return null;
}

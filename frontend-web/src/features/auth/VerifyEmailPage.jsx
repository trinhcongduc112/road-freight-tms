import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Form, Input, Result, Typography } from "antd";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/auth";

const { Text } = Typography;

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
      <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 16px" }}>
        <Alert type="warning" message="Không có token xác thực trong URL." showIcon />
        <div style={{ marginTop: 12 }}>
          <Link to="/login">← Về đăng nhập</Link>
        </div>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div style={{ textAlign: "center", marginTop: 120 }}>
        <LoadingOutlined style={{ fontSize: 40, color: "#1677ff" }} />
        <div style={{ marginTop: 16 }}>Đang xác thực email...</div>
      </div>
    );
  }

  if (state === "ok") {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 16px" }}>
        <Result
          status="success"
          icon={<CheckCircleOutlined />}
          title="Email đã được xác thực!"
          subTitle="Tài khoản của bạn đã được kích hoạt. Bạn có thể đăng nhập ngay."
          extra={<Link to="/login"><Button type="primary">Đăng nhập ngay</Button></Link>}
        />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 16px" }}>
        <Result
          status="error"
          icon={<CloseCircleOutlined />}
          title="Xác thực thất bại"
          subTitle={errorMsg || "Token không hợp lệ hoặc đã hết hạn."}
        />
        <Card size="small" title="Gửi lại email xác thực">
          {resendDone ? (
            <Alert type="success" message="Email đã được gửi lại. Kiểm tra hộp thư của bạn." showIcon />
          ) : (
            <Form layout="inline">
              <Form.Item style={{ flex: 1 }}>
                <Input
                  placeholder="Nhập email đã đăng ký"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  type="email"
                />
              </Form.Item>
              <Button loading={resendLoading} onClick={onResend}>Gửi lại</Button>
            </Form>
          )}
        </Card>
        <div style={{ marginTop: 12 }}>
          <Link to="/login">← Về đăng nhập</Link>
        </div>
      </div>
    );
  }

  return null;
}

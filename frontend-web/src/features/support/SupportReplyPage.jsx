import { CustomerServiceOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Form, Input, Spin, Typography } from "antd";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supportApi } from "../../api/support";

const { Title, Text } = Typography;

const SENDER_LABEL = {
  user: "Khách hàng",
  bot: "Trợ lý AI",
  human: "Tư vấn viên",
  system: "Hệ thống"
};

export default function SupportReplyPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [context, setContext] = useState(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Thiếu token. Vui lòng mở link từ email gốc.");
      setLoading(false);
      return;
    }
    supportApi.replyContext(token)
      .then((res) => {
        setContext(res?.data ?? res);
      })
      .catch((err) => setError(err.message || "Không tải được thông tin phiên chat"))
      .finally(() => setLoading(false));
  }, [token]);

  const onSubmit = async ({ message: body, agentName }) => {
    if (!body?.trim()) return;
    setSubmitting(true);
    try {
      await supportApi.submitReply({ token, message: body.trim(), agentName: agentName?.trim() });
      message.success("Đã gửi phản hồi tới khách hàng");
      form.resetFields(["message"]);
      setSent(true);
    } catch (err) {
      message.error(err.message || "Không gửi được");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 560, margin: "80px auto", padding: 16 }}>
        <Alert type="error" showIcon message="Không mở được link" description={error} />
      </div>
    );
  }

  const messages = context?.messages ?? [];

  return (
    <div style={{ maxWidth: 760, margin: "32px auto", padding: 16 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <CustomerServiceOutlined style={{ fontSize: 28, color: "#4f46e5" }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Phản hồi tư vấn</Title>
            <Text type="secondary">Road Freight TMS · Trang dành cho tư vấn viên</Text>
          </div>
        </div>

        {context?.user && (
          <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <div><b>Khách:</b> {context.user.fullName || context.user.userName}</div>
            <div><b>Email:</b> <a href={`mailto:${context.user.email}`}>{context.user.email}</a></div>
            {context.subject && <div><b>Chủ đề:</b> {context.subject}</div>}
          </div>
        )}

        <Title level={5} style={{ marginTop: 8 }}>Lịch sử hội thoại</Title>
        <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#fafafa", marginBottom: 16 }}>
          {messages.length === 0 ? (
            <Text type="secondary">(Chưa có hội thoại)</Text>
          ) : messages.map((m, idx) => (
            <div key={idx} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>
                {SENDER_LABEL[m.sender] || m.sender}
                {m.createdAt && <span style={{ marginLeft: 8 }}>{new Date(m.createdAt).toLocaleString()}</span>}
              </div>
              <div style={{
                background: m.sender === "user" ? "#dbeafe" : "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                padding: "8px 10px"
              }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.body}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>

        {sent && (
          <Alert
            type="success"
            showIcon
            message="Đã gửi tin nhắn"
            description="Khách hàng đã thấy phản hồi trong app. Bạn có thể đóng tab hoặc gửi tiếp nếu cần."
            style={{ marginBottom: 16 }}
          />
        )}

        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item label="Tên tư vấn viên (tuỳ chọn)" name="agentName">
            <Input placeholder="VD: Đức (Support)" maxLength={60} />
          </Form.Item>
          <Form.Item label="Nội dung phản hồi" name="message" rules={[{ required: true, message: "Nhập nội dung" }]}>
            <Input.TextArea rows={5} placeholder="Gõ phản hồi gửi tới khách hàng..." />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} size="large">
            Gửi cho khách
          </Button>
        </Form>
      </Card>
    </div>
  );
}

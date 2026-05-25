import { CloseOutlined, RobotOutlined, SendOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Button, Input, Spin, Tag, message as antdMessage } from "antd";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { agentApi } from "../api/agent";
import { useLanguage } from "../i18n";

const SUGGESTIONS = [
  { vi: "Tải báo cáo tháng này", en: "Download this month's report" },
  { vi: "Mở trang Lập kế hoạch", en: "Open Planning page" },
  { vi: "Xem đơn hàng chờ duyệt", en: "Show pending orders" }
];

function execAction(action, navigate, t) {
  if (!action || action.type !== "navigate" || !action.path) return;
  navigate(action.path);
  antdMessage.success(t("agent.actionDone", { label: action.label || action.path }));
}

export default function AiAgentPanel({ open, onClose }) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [messages, setMessages] = useState(() => [
    { role: "agent", body: t("agent.welcome") }
  ]);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send(text = input) {
    const command = String(text).trim();
    if (!command || loading) return;
    setInput("");
    setLoading(true);
    setProgressLabel(t("agent.working"));
    setMessages((prev) => [...prev, { role: "user", body: command }]);

    try {
      const history = messages.slice(-8);
      // Stream: update label theo mỗi progress event để user thấy AI đang làm gì
      const payload = await agentApi.executeStream(command, history, (evt) => {
        if (evt.type === "progress" && evt.label) setProgressLabel(evt.label);
      });
      const message = payload?.message ?? "";
      const actions = Array.isArray(payload?.actions) ? payload.actions : [];

      setMessages((prev) => [...prev, { role: "agent", body: message, actions }]);

      // Auto-thực thi action ngay (delay nhỏ để user nhìn thấy tin nhắn trước)
      if (actions.length > 0) {
        setTimeout(() => {
          for (const a of actions) execAction(a, navigate, t);
          // Đóng panel sau khi chuyển trang để user thấy kết quả
          onClose?.();
        }, 600);
      }
    } catch (err) {
      antdMessage.error(err.message || t("agent.error.send"));
      setMessages((prev) => [...prev, { role: "agent", body: t("agent.error.send") }]);
    } finally {
      setLoading(false);
      setProgressLabel("");
    }
  }

  if (!open) return null;

  return (
    <section className="support-chat-panel ai-agent-panel" aria-label={t("agent.title")}>
      <div className="support-chat-head ai-agent-head">
        <div>
          <div className="support-chat-brand">
            <RobotOutlined />
            <span>{t("agent.title")}</span>
          </div>
          <div className="support-chat-user">
            <ThunderboltOutlined style={{ color: "#fde68a", marginRight: 6 }} />
            <span style={{ fontSize: 12, color: "#e0e7ff" }}>{t("agent.tagline")}</span>
          </div>
        </div>
        <button type="button" className="support-chat-close" onClick={onClose} aria-label={t("support.close")}>
          <CloseOutlined />
        </button>
      </div>

      <div className="support-chat-body">
        {messages.length <= 1 && (
          <div className="support-chat-prompts">
            {SUGGESTIONS.map((s) => {
              const label = language === "en" ? s.en : s.vi;
              return (
                <Tag key={label} className="support-chat-prompt" onClick={() => send(label)}>
                  {label}
                </Tag>
              );
            })}
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMe = msg.role === "user";
          return (
            <div key={idx} className={`support-chat-msg ${isMe ? "is-user" : "is-agent"}`}>
              <div className="support-chat-bubble">
                {isMe ? msg.body : (
                  <>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.body}</ReactMarkdown>
                    {Array.isArray(msg.actions) && msg.actions.length > 0 && (
                      <div className="ai-agent-actions">
                        {msg.actions.map((a, i) => (
                          <span key={i} className="ai-agent-action-chip">
                            ⚡ {a.label || a.path}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="support-chat-loading">
            <Spin size="small" />
            <span style={{ marginLeft: 8, fontSize: 12, color: "#64748b" }}>
              {progressLabel || t("agent.working")}…
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="support-chat-input">
        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 3 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("agent.placeholder")}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={() => send()} />
      </div>
    </section>
  );
}

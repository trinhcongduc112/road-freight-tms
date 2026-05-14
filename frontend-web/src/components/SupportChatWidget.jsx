import {
  CloseOutlined,
  CustomerServiceOutlined,
  SendOutlined
} from "@ant-design/icons";
import { Button, Input, Spin, Tag, message as antdMessage } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSocket } from "../api/socket";
import { supportApi } from "../api/support";
import { useAuthStore } from "../store/authStore";

const QUICK_PROMPTS = [
  "Hôm nay có bao nhiêu đơn chưa vào kế hoạch?",
  "Cách tối ưu lộ trình?",
  "Có bao nhiêu xe đang Active?",
  "Tôi muốn gặp nhân viên hỗ trợ"
];

const WELCOME = {
  sender: "bot",
  body: "Xin chào! Mình là trợ lý AI của Road Freight TMS. Bạn có thể hỏi về **đơn hàng, xe, tài xế, tuyến giao, sự cố, báo cáo**. Nếu mình không trả lời được, mình sẽ chuyển cho tư vấn viên.",
  createdAt: new Date().toISOString()
};

function normalizeSession(session) {
  if (!session) return null;
  return { ...session, messages: session.messages ?? [] };
}

export default function SupportChatWidget({ open, onClose }) {
  const user = useAuthStore((s) => s.user);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const bottomRef = useRef(null);

  const initials = useMemo(() => {
    const name = user?.FullName || user?.UserName || "U";
    return name.slice(0, 1).toUpperCase();
  }, [user]);

  const messages = session?.messages?.length ? session.messages : [WELCOME];

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    supportApi.chatSession()
      .then((res) => setSession(normalizeSession(res?.data ?? res)))
      .catch(() => setSession(null));
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;

    const onChatMessage = ({ sessionId, message }) => {
      setSession((current) => {
        if (!current || String(current._id) !== String(sessionId)) return current;
        if (!message) return current;
        const msgKey = `${message.sender}|${message.body}|${message.createdAt ?? ""}`;
        const exists = current.messages?.some((m) => {
          const mKey = `${m.sender}|${m.body}|${m.createdAt ?? ""}`;
          return mKey === msgKey;
        });
        return exists ? current : { ...current, messages: [...(current.messages ?? []), message] };
      });
    };

    socket.on("chat_message", onChatMessage);
    return () => {
      socket.off("chat_message", onChatMessage);
    };
  }, [open]);

  async function send(text = input, options = {}) {
    const body = text.trim();
    if (!body || loading) return;
    setInput("");
    setLoading(true);
    try {
      const res = await supportApi.chatMessage(body, {
        sessionId: session?._id,
        forceSupport: options.forceSupport === true || body.toLowerCase().includes("gặp nhân viên")
      });
      const payload = res?.data ?? res;
      setSession(normalizeSession(payload?.session ?? payload));
    } catch (err) {
      antdMessage.error(err.message || "Không gửi được tin nhắn");
    } finally {
      setLoading(false);
    }
  }

  async function resumeBot() {
    if (!session?._id || loading) return;
    setLoading(true);
    try {
      const res = await supportApi.resumeBot(session._id);
      const payload = res?.data ?? res;
      setSession(normalizeSession(payload?.session ?? payload));
    } catch (err) {
      antdMessage.error(err.message || "Không quay lại AI được");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const renderMessage = (msg, idx) => {
    const isMe = msg.sender === "user";
    const isHuman = msg.sender === "human";
    return (
      <div key={`${msg.sender}-${idx}-${msg.createdAt ?? ""}`} className={`support-chat-msg ${isMe ? "is-user" : "is-agent"}`}>
        <div className="support-chat-bubble">
          {isMe ? msg.body : (
            <>
              {isHuman && <b>Tư vấn viên: </b>}
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.body}</ReactMarkdown>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="support-chat-panel" aria-label="Trợ lý AI Road Freight TMS">
      <div className="support-chat-head">
        <div>
          <div className="support-chat-brand">
            <CustomerServiceOutlined />
            <span>Trợ lý AI</span>
          </div>
          <div className="support-chat-user">
            <span className="support-chat-avatar">{initials}</span>
            <span>{`Hi ${user?.UserName ?? "bạn"}`}</span>
          </div>
        </div>
        <button type="button" className="support-chat-close" onClick={onClose} aria-label="Đóng">
          <CloseOutlined />
        </button>
      </div>

      <div className="support-chat-body">
        {messages.length <= 1 && (
          <div className="support-chat-prompts">
            {QUICK_PROMPTS.map((prompt) => (
              <Tag key={prompt} className="support-chat-prompt" onClick={() => send(prompt, { forceSupport: prompt.includes("nhân viên") })}>
                {prompt}
              </Tag>
            ))}
          </div>
        )}
        {messages.map(renderMessage)}
        {loading && (
          <div className="support-chat-loading">
            <Spin size="small" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {session?.handledBy === "human" && (
        <div className="support-status-banner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", borderTop: "1px solid #fde68a", background: "#fffbeb" }}>
          <span style={{ fontSize: 13, color: "#78350f" }}>Đang chờ tư vấn viên phản hồi.</span>
          <Button size="small" onClick={resumeBot} loading={loading}>
            Quay lại AI
          </Button>
        </div>
      )}

      <div className="support-chat-input">
        {messages.length > 1 && session?.handledBy !== "human" && (
          <Button className="support-human-btn" onClick={() => send("Tôi muốn gặp nhân viên hỗ trợ", { forceSupport: true })}>
            Gặp tư vấn viên
          </Button>
        )}
        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 3 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập câu hỏi của bạn"
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

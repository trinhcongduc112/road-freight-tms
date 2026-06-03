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
import { useLanguage } from "../i18n";

function normalizeSession(session) {
  if (!session) return null;
  return { ...session, messages: session.messages ?? [] };
}

export default function SupportChatWidget({ open, onClose }) {
  const user = useAuthStore((s) => s.user);
  const { t } = useLanguage();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const QUICK_PROMPTS = [
    t("support.quickPrompt.unplanned"),
    t("support.quickPrompt.optimize"),
    t("support.quickPrompt.activeVehicles"),
    t("support.quickPrompt.askHuman"),
  ];
  const WELCOME = {
    sender: "bot",
    body: t("support.welcome"),
    createdAt: new Date().toISOString()
  };
  const [session, setSession] = useState(null);
  const bottomRef = useRef(null);

  const initials = useMemo(() => {
    const name = user?.FullName || user?.UserName || "U";
    return name.slice(0, 1).toUpperCase();
  }, [user]);

  const messages = session?.messages?.length ? session.messages : [WELCOME];
  // Phân biệt 2 trạng thái khi handledBy=human:
  // - lastMsg là human  → consultant đã trả lời (xanh, không còn "đợi")
  // - lastMsg là user   → user vừa hỏi, consultant chưa rep (vàng, "đợi")
  const lastMsg = session?.messages?.[session.messages.length - 1];
  const humanReplied = lastMsg?.sender === "human";

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Fetch session: lúc mở panel, lúc socket reconnect, và lúc tab focus lại.
  // Socket.IO không guarantee delivery — nếu emit rơi vào lúc kết nối đứt đoạn,
  // message sẽ mất. 3 trigger này đảm bảo UI luôn sync với DB.
  useEffect(() => {
    if (!open) return undefined;

    const fetchSession = () => {
      supportApi.chatSession()
        .then((res) => setSession(normalizeSession(res?.data ?? res)))
        .catch(() => setSession(null));
    };

    fetchSession();

    const onVisible = () => {
      if (document.visibilityState === "visible") fetchSession();
    };
    document.addEventListener("visibilitychange", onVisible);

    const socket = getSocket();
    if (!socket) {
      return () => document.removeEventListener("visibilitychange", onVisible);
    }

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
    // Khi socket reconnect (sau ngắt mạng / sleep máy), refetch để bắt mọi
    // message đã rơi trong lúc disconnect.
    socket.on("connect", fetchSession);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      socket.off("chat_message", onChatMessage);
      socket.off("connect", fetchSession);
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
      antdMessage.error(err.message || t("support.error.send"));
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
      antdMessage.error(err.message || t("support.error.resumeBot"));
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
              {isHuman && <b>{t("support.consultantLabel")}: </b>}
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.body}</ReactMarkdown>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="support-chat-panel" aria-label={t("support.title")}>
      <div className="support-chat-head">
        <div>
          <div className="support-chat-brand">
            <CustomerServiceOutlined />
            <span>{t("support.title")}</span>
          </div>
          <div className="support-chat-user">
            <span className="support-chat-avatar">{initials}</span>
            <span>{t("support.greet", { name: user?.UserName ?? "" })}</span>
          </div>
        </div>
        <button type="button" className="support-chat-close" onClick={onClose} aria-label={t("support.close")}>
          <CloseOutlined />
        </button>
      </div>

      <div className="support-chat-body">
        {messages.length <= 1 && (
          <div className="support-chat-prompts">
            {QUICK_PROMPTS.map((prompt) => (
              <Tag key={prompt} className="support-chat-prompt" onClick={() => send(prompt, { forceSupport: prompt === t("support.quickPrompt.askHuman") })}>
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
        <div
          className="support-status-banner"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 12px",
            borderTop: `1px solid ${humanReplied ? "#bbf7d0" : "#fde68a"}`,
            background: humanReplied ? "#f0fdf4" : "#fffbeb"
          }}
        >
          <span style={{ fontSize: 13, color: humanReplied ? "#166534" : "#78350f" }}>
            {humanReplied ? t("support.humanReplied") : t("support.waitingHuman")}
          </span>
          <Button size="small" onClick={resumeBot} loading={loading}>
            {t("support.resumeBot")}
          </Button>
        </div>
      )}

      <div className="support-chat-input">
        {messages.length > 1 && session?.handledBy !== "human" && (
          <Button className="support-human-btn" onClick={() => send(t("support.quickPrompt.askHuman"), { forceSupport: true })}>
            {t("support.requestHuman")}
          </Button>
        )}
        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 3 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("support.placeholder")}
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

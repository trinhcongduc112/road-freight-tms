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
  body: "Xin chào! Mình là trợ lý AI của Road Freight TMS. Bạn có thể hỏi về **đơn hàng, xe, tài xế, tuyến giao, sự cố, báo cáo**. Nếu cần người thật, mình sẽ chuyển ngay cho nhân viên hỗ trợ.",
  createdAt: new Date().toISOString()
};

function canSupportReply(user, role) {
  const perms = role?.Permissions ?? [];
  return Boolean(user?.IsSuperAdmin || perms.includes("*"));
}

function normalizeSession(session) {
  if (!session) return null;
  return { ...session, messages: session.messages ?? [] };
}

export default function SupportChatWidget({ open, onClose }) {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const isAdmin = canSupportReply(user, role);
  const [input, setInput] = useState("");
  const [adminInput, setAdminInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [adminSessions, setAdminSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const bottomRef = useRef(null);

  const initials = useMemo(() => {
    const name = user?.FullName || user?.UserName || "U";
    return name.slice(0, 1).toUpperCase();
  }, [user]);

  const activeAdminSession = adminSessions.find((item) => item._id === activeSessionId) ?? adminSessions[0] ?? null;
  const userMessages = session?.messages?.length ? session.messages : [WELCOME];

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [userMessages, activeAdminSession?.messages, open]);

  useEffect(() => {
    if (!open) return;
    if (isAdmin) {
      supportApi.adminChatSessions({ handledBy: "human" })
        .then((res) => {
          const rows = Array.isArray(res) ? res : res.data ?? [];
          setAdminSessions(rows);
          setActiveSessionId((current) => current ?? rows[0]?._id ?? null);
        })
        .catch(() => {});
    } else {
      supportApi.chatSession()
        .then((res) => setSession(normalizeSession(res)))
        .catch(() => setSession(null));
    }
  }, [open, isAdmin]);

  useEffect(() => {
    if (!open) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;

    const upsertSession = (nextSession) => {
      setAdminSessions((prev) => {
        const without = prev.filter((item) => item._id !== nextSession._id);
        return [nextSession, ...without];
      });
      setActiveSessionId((current) => current ?? nextSession._id);
    };

    const onUserMessage = ({ sessionId, message }) => {
      setSession((current) => {
        if (!current || String(current._id) !== String(sessionId)) return current;
        if (!message) return current;
        const msgKey = `${message.sender}|${message.body}|${message.createdAt ?? ''}`;
        const exists = current.messages?.some((m) => {
          const mKey = `${m.sender}|${m.body}|${m.createdAt ?? ''}`;
          return mKey === msgKey;
        });
        return exists ? current : { ...current, messages: [...(current.messages ?? []), message] };
      });
    };
    const onAdminAlert = ({ session: nextSession }) => upsertSession(nextSession);
    const onAdminMessage = ({ session: nextSession }) => upsertSession(nextSession);

    socket.on("chat_message", onUserMessage);
    socket.on("admin_alert_new_ticket", onAdminAlert);
    socket.on("support_admin_message", onAdminMessage);
    return () => {
      socket.off("chat_message", onUserMessage);
      socket.off("admin_alert_new_ticket", onAdminAlert);
      socket.off("support_admin_message", onAdminMessage);
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
      setSession(normalizeSession(res.session));
    } catch (err) {
      antdMessage.error(err.message || "Không gửi được tin nhắn");
    } finally {
      setLoading(false);
    }
  }

  async function replyAdmin() {
    const body = adminInput.trim();
    if (!body || !activeAdminSession) return;
    setAdminInput("");
    try {
      const res = await supportApi.adminChatReply(activeAdminSession._id, body);
      const nextSession = res;
      setAdminSessions((prev) => [nextSession, ...prev.filter((item) => item._id !== nextSession._id)]);
      setActiveSessionId(nextSession._id);
    } catch (err) {
      antdMessage.error(err.message || "Không gửi được phản hồi");
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
              {isHuman && <b>Nhân viên hỗ trợ: </b>}
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.body}</ReactMarkdown>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="support-chat-panel" aria-label="Trợ lý hỗ trợ Road Freight TMS">
      <div className="support-chat-head">
        <div>
          <div className="support-chat-brand">
            <CustomerServiceOutlined />
            <span>{isAdmin ? "Support Inbox" : "Road Freight Support"}</span>
          </div>
          <div className="support-chat-user">
            <span className="support-chat-avatar">{initials}</span>
            <span>{isAdmin ? "Nhân viên trực" : `Hi ${user?.UserName ?? "bạn"}`}</span>
          </div>
        </div>
        <button type="button" className="support-chat-close" onClick={onClose} aria-label="Đóng">
          <CloseOutlined />
        </button>
      </div>

      {isAdmin ? (
        <>
          <div className="support-chat-body support-admin-body">
            <div className="support-ticket-list">
              {adminSessions.length === 0 ? (
                <div className="support-status-banner">Chưa có cuộc chat cần nhân viên xử lý.</div>
              ) : adminSessions.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  className={`support-ticket-item ${activeAdminSession?._id === item._id ? "is-active" : ""}`}
                  onClick={() => setActiveSessionId(item._id)}
                >
                  <strong>{item.user?.FullName || item.user?.UserName || item.subject || "User"}</strong>
                  <span>{item.subject || item.messages?.[0]?.body || "Yêu cầu hỗ trợ"}</span>
                </button>
              ))}
            </div>
            <div>
              {(activeAdminSession?.messages ?? []).map(renderMessage)}
              <div ref={bottomRef} />
            </div>
          </div>
          <div className="support-chat-input">
            <Input.TextArea
              autoSize={{ minRows: 1, maxRows: 3 }}
              value={adminInput}
              onChange={(e) => setAdminInput(e.target.value)}
              placeholder="Nhập phản hồi cho khách"
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  replyAdmin();
                }
              }}
            />
            <Button type="primary" icon={<SendOutlined />} disabled={!activeAdminSession} onClick={replyAdmin} />
          </div>
        </>
      ) : (
        <>
          <div className="support-chat-body">
            {userMessages.length <= 1 && (
              <div className="support-chat-prompts">
                {QUICK_PROMPTS.map((prompt) => (
                  <Tag key={prompt} className="support-chat-prompt" onClick={() => send(prompt, { forceSupport: prompt.includes("nhân viên") })}>
                    {prompt}
                  </Tag>
                ))}
              </div>
            )}
            {session?.handledBy === "human" && (
              <div className="support-status-banner">Đang chờ nhân viên hỗ trợ phản hồi.</div>
            )}
            {userMessages.map(renderMessage)}
            {loading && (
              <div className="support-chat-loading">
                <Spin size="small" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="support-chat-input">
            {userMessages.length > 1 && (
              <Button className="support-human-btn" onClick={() => send("Tôi muốn gặp nhân viên hỗ trợ", { forceSupport: true })}>
                Gặp nhân viên hỗ trợ
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
        </>
      )}
    </section>
  );
}

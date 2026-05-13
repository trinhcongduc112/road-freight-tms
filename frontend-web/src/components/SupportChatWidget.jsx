import {
  CloseOutlined,
  CustomerServiceOutlined,
  SendOutlined
} from "@ant-design/icons";
import { Button, Empty, Input, Spin, Tag, message as antdMessage } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { supportApi } from "../api/support";
import { useAuthStore } from "../store/authStore";

const QUICK_PROMPTS = [
  "Cách tối ưu lộ trình?",
  "Vì sao đơn chưa vào kế hoạch?",
  "Cách gán tài xế?",
  "Cách thêm dữ liệu mẫu?"
];

const WELCOME = {
  sender: "AI",
  body: "Tôi có thể trả lời các câu hỏi về Road Freight TMS: đơn hàng, master data, lập kế hoạch, tài xế, xe, tuyến giao hàng và báo cáo."
};

export default function SupportChatWidget({ open, onClose }) {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [messages, setMessages] = useState([WELCOME]);
  const bottomRef = useRef(null);
  const canTrainAi = false;
  const isSupportMode = canTrainAi && (!!user?.IsSuperAdmin || (role?.Permissions ?? []).includes("*"));

  const initials = useMemo(() => {
    const name = user?.FullName || user?.UserName || "U";
    return name.slice(0, 1).toUpperCase();
  }, [user]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    if (isSupportMode) {
      loadTickets();
    } else {
      setActiveTicketId(null);
      setTickets([]);
      setMessages([WELCOME]);
    }
  }, [open, isSupportMode]);

  useEffect(() => {
    if (!open) return undefined;
    if (!isSupportMode && !activeTicketId) return undefined;
    const timer = window.setInterval(loadTickets, 5000);
    return () => window.clearInterval(timer);
  }, [open, activeTicketId, isSupportMode]);

  function ticketMessages(ticket) {
    return isSupportMode
      ? ticket.Messages.map((m) => ({ sender: m.Sender, body: m.Body }))
      : [WELCOME, ...ticket.Messages.map((m) => ({ sender: m.Sender, body: m.Body }))];
  }

  function selectTicket(ticket) {
    setActiveTicketId(ticket._id);
    setMessages(ticketMessages(ticket));
  }

  function loadTickets() {
    if (!isSupportMode && !activeTicketId) return;
    const request = isSupportMode ? supportApi.adminTickets() : supportApi.tickets();
    request
      .then((res) => {
        const list = res.data ?? [];
        setTickets(list);
        const active = list.find((item) => item._id === activeTicketId) ?? list[0];
        if (active) {
          selectTicket(active);
        } else if (!isSupportMode) {
          setActiveTicketId(null);
          setMessages([WELCOME]);
        }
      })
      .catch(() => {});
  }

  async function send(text = input, options = {}) {
    const body = text.trim();
    if (!body || loading) return;
    setInput("");
    setLoading(true);
    setMessages((prev) => [...prev, { sender: isSupportMode ? "SUPPORT" : "USER", body }]);
    try {
      if (isSupportMode && activeTicketId) {
        const res = await supportApi.adminReply(activeTicketId, body);
        const updated = res.data;
        setTickets((prev) => prev.map((item) => item._id === updated._id ? updated : item));
        setMessages(ticketMessages(updated));
      } else if (activeTicketId) {
        const res = await supportApi.sendMessage(activeTicketId, body);
        setMessages([
          WELCOME,
          ...res.data.Messages.map((m) => ({ sender: m.Sender, body: m.Body }))
        ]);
      } else {
        const res = await supportApi.ask(body, options);
        const data = res.data;
        if (data.ticket?._id) setActiveTicketId(data.ticket._id);
        setMessages((prev) => [...prev, { sender: data.handledBy === "AI" ? "AI" : "SUPPORT", body: data.message }]);
      }
    } catch (err) {
      antdMessage.error(err.message || "Không gửi được tin nhắn");
      setMessages((prev) => [...prev, { sender: "AI", body: "Tạm thời chưa gửi được tin nhắn. Vui lòng thử lại sau." }]);
    } finally {
      setLoading(false);
    }
  }

  async function learnActiveTicket() {
    if (!activeTicketId || loading) return;
    setLoading(true);
    try {
      await supportApi.adminLearn(activeTicketId);
      antdMessage.success("Đã đưa câu trả lời vào dữ liệu AI");
    } catch (err) {
      antdMessage.error(err.message || "Không học được từ ticket này");
    } finally {
      setLoading(false);
    }
  }

  async function seedKnowledge() {
    setLoading(true);
    try {
      const res = await supportApi.seedDefaults();
      antdMessage.success(res.data?.created ? "Đã tạo dữ liệu AI mặc định" : "Dữ liệu AI mặc định đã có sẵn");
    } catch (err) {
      antdMessage.error(err.message || "Không tạo được dữ liệu AI mặc định");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <section className="support-chat-panel" aria-label="Trợ lý hỗ trợ Road Freight TMS">
          <div className="support-chat-head">
            <div>
              <div className="support-chat-brand">
                <CustomerServiceOutlined />
                <span>Road Freight Support</span>
              </div>
              <div className="support-chat-user">
                <span className="support-chat-avatar">{initials}</span>
                <span>{isSupportMode ? "Hỏi đáp" : `Hi ${user?.UserName ?? "bạn"}`}</span>
              </div>
            </div>
            <button type="button" className="support-chat-close" onClick={onClose} aria-label="Đóng">
              <CloseOutlined />
            </button>
          </div>

          {isSupportMode && (
            <div className="support-ticket-list">
              {canTrainAi && (
                <div className="support-admin-actions">
                  <Button size="small" onClick={seedKnowledge} loading={loading}>Nạp dữ liệu AI mẫu</Button>
                  <Button size="small" type="primary" ghost onClick={learnActiveTicket} disabled={!activeTicketId || loading}>
                    Đưa vào dữ liệu AI
                  </Button>
                </div>
              )}
              {tickets.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có yêu cầu hỗ trợ" />
              ) : tickets.map((ticket) => (
                <button
                  key={ticket._id}
                  type="button"
                  className={`support-ticket-item ${ticket._id === activeTicketId ? "is-active" : ""}`}
                  onClick={() => selectTicket(ticket)}
                >
                  <span>{ticket.Subject}</span>
                  <Tag color={ticket.Status === "OPEN" ? "orange" : "green"}>{ticket.Status}</Tag>
                </button>
              ))}
            </div>
          )}

          <div className="support-chat-body">
            {!isSupportMode && !activeTicketId && (
              <div className="support-chat-prompts">
                {QUICK_PROMPTS.map((prompt) => (
                  <Tag key={prompt} className="support-chat-prompt" onClick={() => send(prompt)}>
                    {prompt}
                  </Tag>
                ))}
              </div>
            )}
            {messages.map((msg, idx) => (
              <div
                key={`${msg.sender}-${idx}`}
                className={`support-chat-msg ${msg.sender === (isSupportMode ? "SUPPORT" : "USER") ? "is-user" : "is-agent"}`}
              >
                <div className="support-chat-bubble">
                  {msg.body}
                </div>
              </div>
            ))}
            {loading && (
              <div className="support-chat-loading">
                <Spin size="small" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="support-chat-input">
            {!isSupportMode && !activeTicketId && messages.length > 1 && (
              <Button
                className="support-human-btn"
                onClick={() => send("Tôi muốn gặp nhân viên hỗ trợ", { forceSupport: true })}
              >
                Gặp nhân viên hỗ trợ
              </Button>
            )}
            <Input.TextArea
              autoSize={{ minRows: 1, maxRows: 3 }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isSupportMode ? "Nhập câu trả lời hỗ trợ" : "Nhập câu hỏi hoặc nội dung cần hỗ trợ"}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={loading}
              disabled={isSupportMode && !activeTicketId}
              onClick={() => send()}
            />
          </div>
        </section>
  );
}

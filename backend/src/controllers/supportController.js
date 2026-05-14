import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { SupportArticle, SupportArticleStatus } from "../models/SupportArticle.js";
import { ChatHandledBy, ChatMessageSender, ChatSession } from "../models/ChatSession.js";
import { ApiError } from "../utils/apiError.js";
import { sendEmail } from "../services/emailService.js";
import { SUPPORT_KNOWLEDGE } from "../utils/supportKnowledge.js";
import { generateAiAnswer } from "../services/aiAssistantService.js";
import { getIO } from "../socket.js";

const REPLY_TOKEN_TTL = "7d";

function signReplyToken(sessionId) {
  return jwt.sign({ sid: String(sessionId), kind: "support-reply" }, env.jwtSecret, { expiresIn: REPLY_TOKEN_TTL });
}

function verifyReplyToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.kind !== "support-reply" || !payload.sid) return null;
    return payload.sid;
  } catch {
    return null;
  }
}

function userOrgId(req) {
  return req.role?.OrganizationID ?? req.user?.OrganizationIDs?.[0] ?? null;
}

function emitChatEvent(room, event, payload) {
  try {
    getIO().to(room).emit(event, payload);
  } catch {
    // socket not ready in tests/dev scripts
  }
}

function publicChatSession(session) {
  return {
    _id: session._id,
    userId: session.userId,
    OrganizationID: session.OrganizationID,
    handledBy: session.handledBy,
    status: session.status,
    subject: session.subject,
    messages: session.messages ?? [],
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

async function getOrCreateChatSession(req, sessionId = null) {
  const orgId = userOrgId(req);
  if (sessionId) {
    const existing = await ChatSession.findOne({ _id: sessionId, userId: req.user._id });
    if (!existing) throw new ApiError(404, "Chat session not found");
    return existing;
  }

  const active = await ChatSession.findOne({
    userId: req.user._id,
    status: { $ne: "CLOSED" }
  }).sort({ updatedAt: -1 });
  if (active) return active;

  return ChatSession.create({
    userId: req.user._id,
    OrganizationID: orgId,
    handledBy: ChatHandledBy.BOT,
    status: "OPEN",
    messages: []
  });
}

function emitUserChat(session, message) {
  emitChatEvent(`user_${session.userId.toString()}`, "chat_message", {
    sessionId: session._id,
    handledBy: session.handledBy,
    message
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function notifySupportSession(session, user, latestQuestion) {
  if (!user?.Email) return;
  const sessionId = session._id.toString();
  const token = signReplyToken(sessionId);
  const replyUrl = `${env.frontendUrl.replace(/\/$/, "")}/support/reply?token=${encodeURIComponent(token)}`;

  const history = (session.messages ?? []).slice(-10);
  const conversationLines = history.length
    ? history.map((m) => `[${m.sender}] ${m.body}`).join("\n\n")
    : "(không có hội thoại trước)";
  const conversationHtml = history.length
    ? history.map((m) =>
        `<div style="margin:6px 0"><b>${escapeHtml(m.sender)}:</b><br/>${escapeHtml(m.body).replace(/\n/g, "<br/>")}</div>`
      ).join("")
    : "<i>(không có hội thoại trước)</i>";

  try {
    await sendEmail({
      to: env.supportEmail,
      subject: `[Road Freight TMS] Hỗ trợ ${user.UserName || user.Email}: ${(session.subject || latestQuestion).slice(0, 60)}`,
      text: `User: ${user.UserName} <${user.Email}>
Session: ${sessionId}

==== CÂU HỎI MỚI NHẤT ====
${latestQuestion}

==== TOÀN BỘ HỘI THOẠI VỚI BOT AI ====
${conversationLines}

>> Để trả lời, mở link sau (hết hạn sau 7 ngày):
${replyUrl}`,
      html: `
        <h2>Yêu cầu hỗ trợ mới từ ${escapeHtml(user.UserName || user.Email)}</h2>
        <p><b>User:</b> <a href="mailto:${escapeHtml(user.Email)}">${escapeHtml(user.Email)}</a></p>
        <p><b>Session ID:</b> <code>${sessionId}</code></p>
        <h3>Câu hỏi mới nhất</h3>
        <p style="background:#f1f5f9;padding:10px;border-radius:6px">${escapeHtml(latestQuestion).replace(/\n/g, "<br/>")}</p>
        <h3>Hội thoại đầy đủ</h3>
        <div style="background:#fafafa;padding:10px;border-radius:6px;border:1px solid #e2e8f0">${conversationHtml}</div>
        <p style="margin-top:14px;padding:14px;background:#eef2ff;border-radius:8px;border:1px solid #c7d2fe;text-align:center">
          <a href="${replyUrl}" style="display:inline-block;padding:10px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">📝 Trả lời khách hàng</a>
          <br/><span style="display:inline-block;margin-top:8px;color:#475569;font-size:12px">Link mở trang nhập phản hồi, gửi xong khách thấy ngay trong app. Hết hạn sau 7 ngày.</span>
        </p>
      `
    });
  } catch (err) {
    console.warn("[support] notifySupportSession failed:", err.message);
  }
}

async function ensureDefaultSupportArticles() {
  const existing = await SupportArticle.countDocuments({ OrganizationID: null, Status: SupportArticleStatus.PUBLISHED });
  if (existing > 0) return;
  await SupportArticle.insertMany(SUPPORT_KNOWLEDGE.map((item) => ({
    OrganizationID: null,
    Title: item.title,
    Module: "SYSTEM",
    Keywords: item.keywords,
    Question: item.title,
    Answer: item.answer,
    Status: SupportArticleStatus.PUBLISHED
  })));
}

export async function getMyChatSession(req, res) {
  await ensureDefaultSupportArticles();
  const session = await getOrCreateChatSession(req, req.query?.sessionId ?? null);
  res.json({ success: true, data: publicChatSession(session) });
}

export async function getSupportReplyContext(req, res) {
  const sessionId = verifyReplyToken(String(req.query?.token ?? ""));
  if (!sessionId) throw new ApiError(401, "Link không hợp lệ hoặc đã hết hạn");

  const session = await ChatSession.findById(sessionId).populate("userId", "UserName Email FullName");
  if (!session) throw new ApiError(404, "Chat session not found");

  const userDoc = session.userId && typeof session.userId === "object" ? session.userId : null;
  res.json({
    success: true,
    data: {
      sessionId: session._id,
      subject: session.subject,
      handledBy: session.handledBy,
      status: session.status,
      user: userDoc
        ? { userName: userDoc.UserName, email: userDoc.Email, fullName: userDoc.FullName }
        : null,
      messages: (session.messages ?? []).map((m) => ({
        sender: m.sender,
        body: m.body,
        createdAt: m.createdAt
      }))
    }
  });
}

export async function submitSupportReply(req, res) {
  const sessionId = verifyReplyToken(String(req.body?.token ?? ""));
  if (!sessionId) throw new ApiError(401, "Link không hợp lệ hoặc đã hết hạn");
  const body = String(req.body?.message ?? "").trim();
  if (!body) throw new ApiError(400, "message is required");
  const agentName = String(req.body?.agentName ?? "").trim().slice(0, 60);

  const session = await ChatSession.findById(sessionId);
  if (!session) throw new ApiError(404, "Chat session not found");

  const prefixed = agentName ? `[${agentName}] ${body}` : body;
  const message = {
    sender: ChatMessageSender.HUMAN,
    body: prefixed,
    createdAt: new Date()
  };
  session.handledBy = ChatHandledBy.HUMAN;
  session.status = "ANSWERED";
  session.messages.push(message);
  await session.save();
  emitUserChat(session, message);

  res.json({ success: true, data: { sessionId: session._id, message: prefixed } });
}

export async function resumeBot(req, res) {
  const session = await ChatSession.findOne({
    _id: req.body?.sessionId,
    userId: req.user._id
  });
  if (!session) throw new ApiError(404, "Chat session not found");

  session.handledBy = ChatHandledBy.BOT;
  session.status = "OPEN";
  const notice = {
    sender: ChatMessageSender.BOT,
    body: "Đã quay lại trợ lý AI. Bạn có thể tiếp tục hỏi mình nhé.",
    createdAt: new Date()
  };
  session.messages.push(notice);
  await session.save();
  emitUserChat(session, notice);
  res.json({
    success: true,
    data: { handledBy: ChatHandledBy.BOT, session: publicChatSession(session), message: notice.body }
  });
}

export async function sendChatMessage(req, res) {
  const body = String(req.body?.message ?? "").trim();
  const forceSupport = req.body?.forceSupport === true;
  if (!body) throw new ApiError(400, "message is required");

  await ensureDefaultSupportArticles();

  const session = await getOrCreateChatSession(req, req.body?.sessionId ?? null);
  const userMessage = {
    sender: ChatMessageSender.USER,
    body,
    userId: req.user._id,
    createdAt: new Date()
  };
  if (!session.subject) session.subject = body.slice(0, 80);
  session.messages.push(userMessage);
  await session.save();
  emitUserChat(session, userMessage);

  if (session.handledBy === ChatHandledBy.HUMAN) {
    session.status = "OPEN";
    await session.save();
    await notifySupportSession(session, req.user, body);
    return res.json({
      success: true,
      data: {
        handledBy: ChatHandledBy.HUMAN,
        session: publicChatSession(session),
        message: "Tin nhắn đã được gửi tới tư vấn viên."
      }
    });
  }

  if (forceSupport) {
    session.handledBy = ChatHandledBy.HUMAN;
    session.status = "OPEN";
    const notice = {
      sender: ChatMessageSender.BOT,
      body: "Dạ, em đã chuyển yêu cầu của anh/chị cho tư vấn viên. Anh/chị vui lòng đợi trong giây lát...",
      createdAt: new Date()
    };
    session.messages.push(notice);
    await session.save();
    emitUserChat(session, notice);
    await notifySupportSession(session, req.user, body);
    return res.status(201).json({
      success: true,
      data: { handledBy: ChatHandledBy.HUMAN, session: publicChatSession(session), message: notice.body }
    });
  }

  const ai = await generateAiAnswer({
    question: body,
    orgId: userOrgId(req),
    history: session.messages.slice(0, -1)
  });

  if (ai.ok && ai.handoff) {
    session.handledBy = ChatHandledBy.HUMAN;
    session.status = "OPEN";
    const notice = {
      sender: ChatMessageSender.BOT,
      body: "Mình chưa trả lời được câu này, em đã chuyển sang tư vấn viên. Anh/chị vui lòng đợi trong giây lát...",
      createdAt: new Date()
    };
    session.messages.push(notice);
    await session.save();
    emitUserChat(session, notice);
    await notifySupportSession(session, req.user, body);
    return res.status(201).json({
      success: true,
      data: { handledBy: ChatHandledBy.HUMAN, session: publicChatSession(session), message: notice.body }
    });
  }

  const botText = ai.message || "Mình chưa có câu trả lời chắc chắn cho ý này. Bạn có thể bấm Gặp tư vấn viên để được hỗ trợ trực tiếp.";
  const botMessage = {
    sender: ChatMessageSender.BOT,
    body: botText,
    createdAt: new Date()
  };
  session.messages.push(botMessage);
  await session.save();
  emitUserChat(session, botMessage);
  return res.json({
    success: true,
    data: { handledBy: ChatHandledBy.BOT, session: publicChatSession(session), message: botText }
  });
}

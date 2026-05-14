import { env } from "../config/env.js";
import { SupportArticle, SupportArticleStatus } from "../models/SupportArticle.js";
import { SupportTicket, SupportTicketStatus } from "../models/SupportTicket.js";
import { ChatHandledBy, ChatMessageSender, ChatSession } from "../models/ChatSession.js";
import { ApiError } from "../utils/apiError.js";
import { sendEmail } from "../services/emailService.js";
import { findBestSupportKnowledge, scoreSupportArticle, SUPPORT_KNOWLEDGE } from "../utils/supportKnowledge.js";
import { generateAiAnswer, isAiEnabled } from "../services/aiAssistantService.js";
import { getIO } from "../socket.js";

function userOrgId(req) {
  return req.role?.OrganizationID ?? req.user?.OrganizationIDs?.[0] ?? null;
}

function canSupportReply(req) {
  const perms = req.role?.Permissions ?? [];
  return !!req.user?.IsSuperAdmin || perms.includes("*");
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
    updatedAt: session.updatedAt,
    user: session.userId && typeof session.userId === "object" ? session.userId : undefined
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

function emitAdminHandoff(session, latestMessage) {
  const payload = { session: publicChatSession(session), latestMessage };
  if (session.OrganizationID) {
    emitChatEvent(`org_${session.OrganizationID.toString()}`, "admin_alert_new_ticket", payload);
  }
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

async function notifySupport(ticket, req, history = []) {
  const user = req.user;
  const question = ticket.Messages.find((m) => m.Sender === "USER")?.Body ?? "";

  const conversationLines = history.length
    ? history.map((m) => `[${m.sender}] ${m.body}`).join("\n\n")
    : "(không có hội thoại trước)";
  const conversationHtml = history.length
    ? history.map((m) =>
        `<div style="margin:6px 0"><b>${escapeHtml(m.sender)}:</b><br/>${escapeHtml(m.body).replace(/\n/g, "<br/>")}</div>`
      ).join("")
    : "<i>(không có hội thoại trước)</i>";

  await sendEmail({
    to: env.supportEmail,
    subject: `[Road Freight TMS] Hỗ trợ #${ticket._id}: ${ticket.Subject}`,
    text: `User: ${user.UserName} <${user.Email}>
Ticket: ${ticket._id}

==== CÂU HỎI MỚI NHẤT ====
${question}

==== HỘI THOẠI TRƯỚC ĐÓ VỚI BOT AI ====
${conversationLines}

Vui lòng phản hồi trực tiếp tới email người dùng: ${user.Email}`,
    html: `
      <h2>Yêu cầu hỗ trợ mới</h2>
      <p><b>User:</b> ${escapeHtml(user.UserName)} &lt;<a href="mailto:${escapeHtml(user.Email)}">${escapeHtml(user.Email)}</a>&gt;</p>
      <p><b>Ticket:</b> ${ticket._id}</p>
      <h3>Câu hỏi mới nhất</h3>
      <p style="background:#f1f5f9;padding:10px;border-radius:6px">${escapeHtml(question).replace(/\n/g, "<br/>")}</p>
      <h3>Hội thoại trước đó với bot AI</h3>
      <div style="background:#fafafa;padding:10px;border-radius:6px;border:1px solid #e2e8f0">${conversationHtml}</div>
      <p style="margin-top:14px;color:#64748b"><i>Vui lòng phản hồi trực tiếp tới email người dùng. Hệ thống không có giao diện chat ngược lại.</i></p>
    `
  });
}

async function notifySupportSession(session, user, latestQuestion) {
  if (!user?.Email) return;
  const sessionId = session._id.toString();

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
      replyTo: user.Email,
      subject: `[CHAT-SESSION:${sessionId}] Hỗ trợ ${user.UserName || user.Email}: ${(session.subject || latestQuestion).slice(0, 60)}`,
      headers: { "X-Chat-Session-Id": sessionId },
      text: `User: ${user.UserName} <${user.Email}>
Session: ${sessionId}

==== CÂU HỎI MỚI NHẤT ====
${latestQuestion}

==== TOÀN BỘ HỘI THOẠI VỚI BOT AI ====
${conversationLines}

>> Bạn có thể bấm "Trả lời" (Reply) trên email này. Nội dung sẽ tự đẩy về app cho người dùng (giữ nguyên dòng [CHAT-SESSION:${sessionId}] trong subject).`,
      html: `
        <h2>Yêu cầu hỗ trợ mới từ ${escapeHtml(user.UserName || user.Email)}</h2>
        <p><b>User:</b> <a href="mailto:${escapeHtml(user.Email)}">${escapeHtml(user.Email)}</a></p>
        <p><b>Session ID:</b> <code>${sessionId}</code></p>
        <h3>Câu hỏi mới nhất</h3>
        <p style="background:#f1f5f9;padding:10px;border-radius:6px">${escapeHtml(latestQuestion).replace(/\n/g, "<br/>")}</p>
        <h3>Hội thoại đầy đủ</h3>
        <div style="background:#fafafa;padding:10px;border-radius:6px;border:1px solid #e2e8f0">${conversationHtml}</div>
        <p style="margin-top:14px;padding:10px;background:#fef3c7;border-radius:6px;color:#78350f">
          <b>📩 Cách trả lời:</b> Bấm <b>Reply</b> trên email này. Tin nhắn của bạn sẽ tự đẩy về chat trong app cho người dùng — miễn là <b>giữ nguyên dòng <code>[CHAT-SESSION:${sessionId}]</code></b> trong subject.
        </p>
      `
    });
  } catch (err) {
    console.warn("[support] notifySupportSession failed:", err.message);
  }
}

async function findKnowledgeAnswer(question, orgId) {
  await ensureDefaultSupportArticles();
  const articles = await SupportArticle.find({
    Status: SupportArticleStatus.PUBLISHED,
    $or: [{ OrganizationID: null }, { OrganizationID: orgId }]
  }).lean();

  let best = null;
  for (const article of articles) {
    const score = scoreSupportArticle(question, article);
    if (!best || score > best.score) best = { article, score };
  }

  if (best?.score >= 3) return best.article.Answer;

  const fallback = findBestSupportKnowledge(question);
  return fallback?.score >= 3 ? fallback.answer : null;
}

async function ensureDefaultSupportArticles(userId = null) {
  const existing = await SupportArticle.countDocuments({ OrganizationID: null, Status: SupportArticleStatus.PUBLISHED });
  if (existing > 0) return [];
  return SupportArticle.insertMany(SUPPORT_KNOWLEDGE.map((item) => ({
    OrganizationID: null,
    Title: item.title,
    Module: "SYSTEM",
    Keywords: item.keywords,
    Question: item.title,
    Answer: item.answer,
    Status: SupportArticleStatus.PUBLISHED,
    CreatedBy: userId,
    UpdatedBy: userId
  })));
}

export async function askSupportBot(req, res) {
  const question = String(req.body?.message ?? "").trim();
  const forceSupport = req.body?.forceSupport === true;
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  if (!question) throw new ApiError(400, "message is required");

  const orgId = userOrgId(req);

  if (!forceSupport) {
    await ensureDefaultSupportArticles();

    if (isAiEnabled()) {
      const ai = await generateAiAnswer({ question, orgId, history });
      if (ai.ok && !ai.handoff) {
        return res.json({
          success: true,
          data: { handledBy: "AI", message: ai.message }
        });
      }
      if (ai.ok && ai.handoff) {
        return createHandoffTicket(req, res, question, ai.message, history);
      }
      // Gemini lỗi → rơi xuống keyword fallback
      if (ai.message) {
        return res.json({
          success: true,
          data: { handledBy: "AI", message: ai.message }
        });
      }
    } else {
      const answer = await findKnowledgeAnswer(question, orgId);
      if (answer) {
        return res.json({
          success: true,
          data: { handledBy: "AI", message: answer }
        });
      }
      return res.json({
        success: true,
        data: {
          handledBy: "AI",
          message: "Câu hỏi này vượt ngoài phạm vi tôi được huấn luyện trong hệ thống Road Freight TMS. Nếu bạn cần người hỗ trợ trực tiếp, hãy bấm Gặp nhân viên hỗ trợ."
        }
      });
    }

    return res.json({
      success: true,
      data: {
        handledBy: "AI",
        message: "Mình chưa có câu trả lời chính xác cho ý này. Bạn có thể bấm Gặp nhân viên hỗ trợ để được hỗ trợ trực tiếp."
      }
    });
  }

  return createHandoffTicket(req, res, question, null, history);
}

export async function sendChatMessage(req, res) {
  const body = String(req.body?.message ?? "").trim();
  const forceSupport = req.body?.forceSupport === true;
  if (!body) throw new ApiError(400, "message is required");

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
    emitAdminHandoff(session, userMessage);
    await notifySupportSession(session, req.user, body);
    return res.json({
      success: true,
      data: {
        handledBy: ChatHandledBy.HUMAN,
        session: publicChatSession(session),
        message: "Tin nhắn đã được gửi tới nhân viên hỗ trợ."
      }
    });
  }

  if (forceSupport) {
    const wasBot = session.handledBy !== ChatHandledBy.HUMAN;
    session.handledBy = ChatHandledBy.HUMAN;
    session.status = "OPEN";
    const notice = {
      sender: ChatMessageSender.BOT,
      body: "Dạ, em đã chuyển yêu cầu của anh/chị cho nhân viên hỗ trợ. Anh/chị vui lòng đợi trong giây lát...",
      createdAt: new Date()
    };
    session.messages.push(notice);
    await session.save();
    emitUserChat(session, notice);
    emitAdminHandoff(session, userMessage);
    if (wasBot) await notifySupportSession(session, req.user, body);
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
    const wasBot = session.handledBy !== ChatHandledBy.HUMAN;
    session.handledBy = ChatHandledBy.HUMAN;
    session.status = "OPEN";
    const notice = {
      sender: ChatMessageSender.BOT,
      body: "Dạ, em đã chuyển yêu cầu của anh/chị cho nhân viên hỗ trợ. Anh/chị vui lòng đợi trong giây lát...",
      createdAt: new Date()
    };
    session.messages.push(notice);
    await session.save();
    emitUserChat(session, notice);
    emitAdminHandoff(session, userMessage);
    if (wasBot) await notifySupportSession(session, req.user, body);
    return res.status(201).json({
      success: true,
      data: { handledBy: ChatHandledBy.HUMAN, session: publicChatSession(session), message: notice.body }
    });
  }

  const botText = ai.message || "Mình chưa có câu trả lời chắc chắn cho ý này. Bạn có thể yêu cầu gặp nhân viên hỗ trợ.";
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

export async function getMyChatSession(req, res) {
  const session = await getOrCreateChatSession(req, req.query?.sessionId ?? null);
  res.json({ success: true, data: publicChatSession(session) });
}

export async function listAdminChatSessions(req, res) {
  if (!canSupportReply(req)) throw new ApiError(403, "Requires support permission");
  const orgId = userOrgId(req);
  const filter = orgId ? { OrganizationID: orgId } : {};
  if (req.query?.handledBy) filter.handledBy = req.query.handledBy;
  const sessions = await ChatSession.find(filter)
    .sort({ updatedAt: -1 })
    .limit(80)
    .populate("userId", "UserName Email FullName")
    .lean();
  res.json({ success: true, data: sessions.map(publicChatSession) });
}

export async function replyChatSession(req, res) {
  if (!canSupportReply(req)) throw new ApiError(403, "Requires support permission");
  const body = String(req.body?.message ?? "").trim();
  if (!body) throw new ApiError(400, "message is required");

  const orgId = userOrgId(req);
  const filter = { _id: req.params.id };
  if (orgId) filter.OrganizationID = orgId;
  const session = await ChatSession.findOne(filter);
  if (!session) throw new ApiError(404, "Chat session not found");

  session.handledBy = ChatHandledBy.HUMAN;
  session.status = "ANSWERED";
  const message = {
    sender: ChatMessageSender.HUMAN,
    body,
    userId: req.user._id,
    createdAt: new Date()
  };
  session.messages.push(message);
  await session.save();
  emitUserChat(session, message);
  if (session.OrganizationID) {
    emitChatEvent(`org_${session.OrganizationID.toString()}`, "support_admin_message", {
      session: publicChatSession(session),
      message
    });
  }
  res.json({ success: true, data: publicChatSession(session) });
}

async function createHandoffTicket(req, res, question, aiNote = null, history = []) {
  const fallback = aiNote
    ? `${aiNote}\n\nMình đã chuyển yêu cầu của bạn đến nhân viên hỗ trợ qua email. Họ sẽ liên hệ trực tiếp với bạn qua email/Google Chat.`
    : "Đã chuyển yêu cầu đến nhân viên hỗ trợ qua email. Họ sẽ liên hệ trực tiếp với bạn qua email/Google Chat trong thời gian sớm nhất.";

  const ticket = await SupportTicket.create({
    OrganizationID: userOrgId(req),
    UserID: req.user._id,
    Subject: question.slice(0, 80),
    Status: SupportTicketStatus.OPEN,
    Messages: [
      { Sender: "USER", Body: question },
      { Sender: "AI", Body: fallback }
    ]
  });

  await notifySupport(ticket, req, history);
  res.status(201).json({
    success: true,
    data: { handledBy: "SUPPORT", ticket, message: fallback }
  });
}

export async function listMyTickets(req, res) {
  const tickets = await SupportTicket.find({ UserID: req.user._id }).sort({ updatedAt: -1 }).lean();
  res.json({ success: true, data: tickets });
}

export async function addTicketMessage(req, res) {
  const body = String(req.body?.message ?? "").trim();
  if (!body) throw new ApiError(400, "message is required");
  const ticket = await SupportTicket.findOne({ _id: req.params.id, UserID: req.user._id });
  if (!ticket) throw new ApiError(404, "Support ticket not found");
  ticket.Messages.push({ Sender: "USER", Body: body });
  ticket.Status = SupportTicketStatus.OPEN;
  await ticket.save();
  await notifySupport(ticket, req);
  res.json({ success: true, data: ticket });
}

export async function listSupportTickets(req, res) {
  if (!canSupportReply(req)) throw new ApiError(403, "Requires support permission");
  const tickets = await SupportTicket.find({}).sort({ updatedAt: -1 }).populate("UserID", "UserName Email FullName").lean();
  res.json({ success: true, data: tickets });
}

export async function replySupportTicket(req, res) {
  if (!canSupportReply(req)) throw new ApiError(403, "Requires support permission");
  const body = String(req.body?.message ?? "").trim();
  if (!body) throw new ApiError(400, "message is required");
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) throw new ApiError(404, "Support ticket not found");
  ticket.Messages.push({ Sender: "SUPPORT", Body: body });
  ticket.Status = SupportTicketStatus.ANSWERED;
  await ticket.save();
  res.json({ success: true, data: ticket });
}

export async function listSupportArticles(req, res) {
  if (!canSupportReply(req)) throw new ApiError(403, "Requires support permission");
  const orgId = userOrgId(req);
  const articles = await SupportArticle.find({
    $or: [{ OrganizationID: null }, { OrganizationID: orgId }]
  }).sort({ updatedAt: -1 }).lean();
  res.json({ success: true, data: articles });
}

export async function createSupportArticle(req, res) {
  if (!canSupportReply(req)) throw new ApiError(403, "Requires support permission");
  const title = String(req.body?.title ?? "").trim();
  const answer = String(req.body?.answer ?? "").trim();
  if (!title || !answer) throw new ApiError(400, "title and answer are required");

  const article = await SupportArticle.create({
    OrganizationID: req.body?.global === true ? null : userOrgId(req),
    Title: title,
    Module: String(req.body?.module ?? "GENERAL").trim() || "GENERAL",
    Keywords: Array.isArray(req.body?.keywords) ? req.body.keywords.map((k) => String(k).trim()).filter(Boolean) : [],
    Question: String(req.body?.question ?? "").trim(),
    Answer: answer,
    Status: req.body?.status === SupportArticleStatus.DRAFT ? SupportArticleStatus.DRAFT : SupportArticleStatus.PUBLISHED,
    CreatedBy: req.user._id,
    UpdatedBy: req.user._id
  });
  res.status(201).json({ success: true, data: article });
}

export async function updateSupportArticle(req, res) {
  if (!canSupportReply(req)) throw new ApiError(403, "Requires support permission");
  const article = await SupportArticle.findById(req.params.id);
  if (!article) throw new ApiError(404, "Support article not found");

  if (req.body?.title !== undefined) article.Title = String(req.body.title).trim();
  if (req.body?.module !== undefined) article.Module = String(req.body.module).trim() || "GENERAL";
  if (req.body?.keywords !== undefined) {
    article.Keywords = Array.isArray(req.body.keywords) ? req.body.keywords.map((k) => String(k).trim()).filter(Boolean) : [];
  }
  if (req.body?.question !== undefined) article.Question = String(req.body.question).trim();
  if (req.body?.answer !== undefined) article.Answer = String(req.body.answer).trim();
  if (Object.values(SupportArticleStatus).includes(req.body?.status)) article.Status = req.body.status;
  article.UpdatedBy = req.user._id;
  await article.save();
  res.json({ success: true, data: article });
}

export async function learnFromTicket(req, res) {
  if (!canSupportReply(req)) throw new ApiError(403, "Requires support permission");
  const ticket = await SupportTicket.findById(req.params.id).lean();
  if (!ticket) throw new ApiError(404, "Support ticket not found");

  const question = [...ticket.Messages].reverse().find((m) => m.Sender === "USER")?.Body ?? ticket.Subject;
  const answer = [...ticket.Messages].reverse().find((m) => m.Sender === "SUPPORT")?.Body;
  if (!answer) throw new ApiError(400, "Ticket has no support answer to learn from");

  const keywords = [...new Set(
    `${ticket.Subject} ${question}`
      .toLowerCase()
      .split(/[^a-zA-Z0-9À-ỹ]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 4)
      .slice(0, 12)
  )];

  const article = await SupportArticle.create({
    OrganizationID: ticket.OrganizationID ?? userOrgId(req),
    Title: ticket.Subject,
    Module: "SUPPORT",
    Keywords: keywords,
    Question: question,
    Answer: answer,
    Status: SupportArticleStatus.PUBLISHED,
    SourceTicketID: ticket._id,
    CreatedBy: req.user._id,
    UpdatedBy: req.user._id
  });
  res.status(201).json({ success: true, data: article });
}

export async function seedDefaultSupportArticles(req, res) {
  if (!canSupportReply(req)) throw new ApiError(403, "Requires support permission");
  const created = await ensureDefaultSupportArticles(req.user._id);
  if (!created.length) {
    const articles = await SupportArticle.find({ OrganizationID: null }).sort({ updatedAt: -1 }).lean();
    return res.json({ success: true, data: { created: 0, articles } });
  }
  res.status(201).json({ success: true, data: { created: created.length, articles: created } });
}

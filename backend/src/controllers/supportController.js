import { env } from "../config/env.js";
import { SupportArticle, SupportArticleStatus } from "../models/SupportArticle.js";
import { SupportTicket, SupportTicketStatus } from "../models/SupportTicket.js";
import { ApiError } from "../utils/apiError.js";
import { sendEmail } from "../services/emailService.js";
import { findBestSupportKnowledge, scoreSupportArticle, SUPPORT_KNOWLEDGE } from "../utils/supportKnowledge.js";

function userOrgId(req) {
  return req.role?.OrganizationID ?? req.user?.OrganizationIDs?.[0] ?? null;
}

function canSupportReply(req) {
  const perms = req.role?.Permissions ?? [];
  return !!req.user?.IsSuperAdmin || perms.includes("*");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function notifySupport(ticket, req) {
  const user = req.user;
  const latest = ticket.Messages[ticket.Messages.length - 1]?.Body ?? "";
  await sendEmail({
    to: env.supportEmail,
    subject: `[Road Freight TMS] Support #${ticket._id}: ${ticket.Subject}`,
    text: `User: ${user.UserName} <${user.Email}>\nTicket: ${ticket._id}\n\n${latest}`,
    html: `
      <h2>Yêu cầu hỗ trợ mới</h2>
      <p><b>User:</b> ${escapeHtml(user.UserName)} &lt;${escapeHtml(user.Email)}&gt;</p>
      <p><b>Ticket:</b> ${ticket._id}</p>
      <p><b>Nội dung:</b></p>
      <p>${escapeHtml(latest).replace(/\n/g, "<br/>")}</p>
    `
  });
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
  if (!question) throw new ApiError(400, "message is required");

  const answer = await findKnowledgeAnswer(question, userOrgId(req));
  if (answer && !forceSupport) {
    return res.json({
      success: true,
      data: {
        handledBy: "AI",
        message: answer
      }
    });
  }

  if (!forceSupport) {
    return res.json({
      success: true,
      data: {
        handledBy: "AI",
        message: "Câu hỏi này vượt ngoài phạm vi tôi được huấn luyện trong hệ thống Road Freight TMS. Nếu bạn cần người hỗ trợ trực tiếp, hãy bấm Gặp nhân viên hỗ trợ."
      }
    });
  }

  const fallback = forceSupport
    ? "Tôi đã chuyển yêu cầu đến nhân viên hỗ trợ. Bạn có thể tiếp tục nhắn trong ô chat này."
    : "Câu hỏi này vượt ngoài phạm vi tôi được huấn luyện trong hệ thống Road Freight TMS. Tôi đã chuyển câu hỏi đến nhân viên hỗ trợ, bạn có thể tiếp tục nhắn trong ô chat này.";
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

  await notifySupport(ticket, req);
  res.status(201).json({
    success: true,
    data: {
      handledBy: "SUPPORT",
      ticket,
      message: fallback
    }
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

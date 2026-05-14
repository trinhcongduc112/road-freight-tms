import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { env } from "../config/env.js";
import { ChatHandledBy, ChatMessageSender, ChatSession } from "../models/ChatSession.js";
import { logger } from "../utils/logger.js";
import { getIO } from "../socket.js";

const SESSION_TAG_RE = /\[CHAT-SESSION:([a-f0-9]{24})\]/i;

let pollTimer = null;
let polling = false;

function isConfigured() {
  return Boolean(env.imapHost && env.imapUser && env.imapPass);
}

function emitChatMessage(session, message) {
  try {
    const io = getIO();
    io.to(`user_${session.userId.toString()}`).emit("chat_message", {
      sessionId: session._id,
      handledBy: session.handledBy,
      message
    });
    if (session.OrganizationID) {
      io.to(`org_${session.OrganizationID.toString()}`).emit("support_admin_message", {
        session: publicShape(session),
        message
      });
    }
  } catch {
    // socket not ready, ignore
  }
}

function publicShape(session) {
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

/**
 * Bóc tách phần reply mới khỏi quoted text + signature.
 * Heuristic: cắt ở dòng đầu tiên match các pattern phổ biến.
 */
function extractReplyBody(rawText) {
  if (!rawText) return "";
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  const cutMarkers = [
    /^On .+ wrote:$/i,
    /^Vào .+ đã viết:?$/i,
    /^Le .+ a écrit ?:$/i,
    /^Am .+ schrieb .+:$/i,
    /^From: .+/i,
    /^Từ: .+/i,
    /^-{2,}\s*Original Message\s*-{2,}/i,
    /^>{1,}/
  ];
  const out = [];
  for (const line of lines) {
    if (cutMarkers.some((rgx) => rgx.test(line.trim()))) break;
    out.push(line);
  }
  // Xoá signature dạng "-- " hoặc "Sent from my iPhone"
  let body = out.join("\n").trim();
  body = body.replace(/\n--\s*\n[\s\S]*$/, "");
  body = body.replace(/\nSent from my .+$/i, "");
  return body.trim();
}

async function processMessage(client, seq) {
  const message = await client.fetchOne(seq, { source: true, envelope: true, uid: true });
  if (!message) return;

  const subject = message.envelope?.subject ?? "";
  const tagMatch = subject.match(SESSION_TAG_RE);
  if (!tagMatch) return; // không phải reply ticket TMS, bỏ qua

  const sessionId = tagMatch[1];
  const session = await ChatSession.findById(sessionId);
  if (!session) {
    logger.warn(`[support-imap] session ${sessionId} not found, skip`);
    return;
  }

  const parsed = await simpleParser(message.source);
  const fromAddr = parsed.from?.value?.[0]?.address?.toLowerCase() ?? "";
  const supportAddr = (env.imapUser || env.supportEmail).toLowerCase();
  // Bỏ qua email tự gửi (echo của Gmail, hoặc khi support reply-all kèm cc supportEmail)
  if (fromAddr === supportAddr || fromAddr === (env.smtpFrom || "").toLowerCase()) {
    // ok, vẫn xử lý — đây là support trả lời
  }

  const rawText = parsed.text ?? "";
  const cleanBody = extractReplyBody(rawText);
  if (!cleanBody) {
    logger.info(`[support-imap] empty body after strip for session ${sessionId}`);
    return;
  }

  // Tránh trùng: kiểm tra messageId hoặc nội dung gần nhất
  const messageId = parsed.messageId ?? "";
  const lastHuman = [...(session.messages ?? [])].reverse().find((m) => m.sender === ChatMessageSender.HUMAN);
  if (lastHuman && lastHuman.body === cleanBody) {
    return; // đã có
  }

  const newMessage = {
    sender: ChatMessageSender.HUMAN,
    body: cleanBody,
    createdAt: parsed.date ?? new Date()
  };
  session.handledBy = ChatHandledBy.HUMAN;
  session.status = "ANSWERED";
  session.messages.push(newMessage);
  await session.save();

  emitChatMessage(session, newMessage);
  logger.info(`[support-imap] +1 reply on session ${sessionId} (msgId=${messageId.slice(0, 30)})`);
}

async function pollOnce() {
  if (!isConfigured() || polling) return;
  polling = true;

  const client = new ImapFlow({
    host: env.imapHost,
    port: env.imapPort,
    secure: env.imapSecure,
    auth: { user: env.imapUser, pass: env.imapPass },
    logger: false
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Tìm email UNSEEN có subject chứa CHAT-SESSION
      const search = await client.search({ seen: false }, { uid: true });
      if (!search || search.length === 0) return;

      for (const uid of search) {
        try {
          await processMessage(client, uid);
          await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
        } catch (err) {
          logger.warn(`[support-imap] process uid ${uid} failed: ${err.message}`);
        }
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    logger.warn(`[support-imap] poll failed: ${err.message}`);
  } finally {
    try { await client.logout(); } catch {}
    polling = false;
  }
}

export function startSupportEmailInbox() {
  if (!isConfigured()) {
    logger.info("[support-imap] disabled (missing IMAP_HOST/USER/PASS)");
    return;
  }
  if (pollTimer) return;
  logger.info(`[support-imap] enabled — poll ${env.imapUser} every ${env.imapPollIntervalMs}ms`);
  // Poll lần đầu sau 5s để server kịp khởi động
  setTimeout(pollOnce, 5000);
  pollTimer = setInterval(pollOnce, env.imapPollIntervalMs);
}

export function stopSupportEmailInbox() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

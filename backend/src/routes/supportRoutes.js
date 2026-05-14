import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  addTicketMessage,
  askSupportBot,
  createSupportArticle,
  getMyChatSession,
  learnFromTicket,
  listAdminChatSessions,
  listMyTickets,
  listSupportArticles,
  listSupportTickets,
  replyChatSession,
  replySupportTicket,
  seedDefaultSupportArticles,
  sendChatMessage,
  updateSupportArticle
} from "../controllers/supportController.js";

export const supportRouter = Router();

supportRouter.use(authenticate);

supportRouter.get("/chat/session", asyncHandler(getMyChatSession));
supportRouter.post("/chat/message", asyncHandler(sendChatMessage));
supportRouter.get("/admin/chat-sessions", asyncHandler(listAdminChatSessions));
supportRouter.post("/admin/chat-sessions/:id/reply", asyncHandler(replyChatSession));

supportRouter.post("/ask", asyncHandler(askSupportBot));
supportRouter.get("/tickets", asyncHandler(listMyTickets));
supportRouter.post("/tickets/:id/messages", asyncHandler(addTicketMessage));
supportRouter.get("/admin/tickets", asyncHandler(listSupportTickets));
supportRouter.post("/admin/tickets/:id/reply", asyncHandler(replySupportTicket));
supportRouter.post("/admin/tickets/:id/learn", asyncHandler(learnFromTicket));
supportRouter.get("/admin/articles", asyncHandler(listSupportArticles));
supportRouter.post("/admin/articles", asyncHandler(createSupportArticle));
supportRouter.patch("/admin/articles/:id", asyncHandler(updateSupportArticle));
supportRouter.post("/admin/articles/seed-defaults", asyncHandler(seedDefaultSupportArticles));

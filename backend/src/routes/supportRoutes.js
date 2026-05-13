import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  addTicketMessage,
  askSupportBot,
  createSupportArticle,
  learnFromTicket,
  listMyTickets,
  listSupportArticles,
  listSupportTickets,
  replySupportTicket,
  seedDefaultSupportArticles,
  updateSupportArticle
} from "../controllers/supportController.js";

export const supportRouter = Router();

supportRouter.use(authenticate);

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

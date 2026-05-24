import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getMyChatSession,
  getSupportReplyContext,
  resumeBot,
  sendChatMessage,
  submitSupportReply
} from "../controllers/supportController.js";

export const supportRouter = Router();

supportRouter.get("/reply-context", asyncHandler(getSupportReplyContext));
supportRouter.post("/reply", asyncHandler(submitSupportReply));

supportRouter.use(authenticate);

supportRouter.get("/chat/session", asyncHandler(getMyChatSession));
supportRouter.post("/chat/message", asyncHandler(sendChatMessage));
supportRouter.post("/chat/resume-bot", asyncHandler(resumeBot));

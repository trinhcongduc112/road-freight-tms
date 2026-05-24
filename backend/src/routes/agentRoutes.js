import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { executeAgent, executeAgentStream } from "../controllers/agentController.js";

export const agentRouter = Router();

agentRouter.use(authenticate);
agentRouter.post("/execute", asyncHandler(executeAgent));
// Streaming variant: NDJSON progress events realtime — UI hiển thị "Đang gọi tool X..."
agentRouter.post("/stream", asyncHandler(executeAgentStream));

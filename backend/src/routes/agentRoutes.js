import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { executeAgent } from "../controllers/agentController.js";

export const agentRouter = Router();

agentRouter.use(authenticate);
agentRouter.post("/execute", asyncHandler(executeAgent));

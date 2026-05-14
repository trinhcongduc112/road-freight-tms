import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { contactRateLimiter } from "../middlewares/rateLimit.js";
import { submitContact } from "../controllers/contactController.js";

export const contactRouter = Router();

contactRouter.post("/contact", contactRateLimiter, asyncHandler(submitContact));

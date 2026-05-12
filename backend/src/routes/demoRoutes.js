import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { seedDemo, clearDemo, demoStatus } from "../controllers/demoController.js";

export const demoRouter = Router();

demoRouter.use(authenticate);

demoRouter.get("/status",  asyncHandler(demoStatus));
demoRouter.post("/seed",   asyncHandler(seedDemo));
demoRouter.delete("/clear", asyncHandler(clearDemo));

import { ApiError } from "../utils/apiError.js";
import { logger } from "../utils/logger.js";

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate value",
      details: err.keyValue
    });
  }

  logger.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
}

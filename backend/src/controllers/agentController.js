import { ApiError } from "../utils/apiError.js";
import { runAgent } from "../services/aiAgentService.js";

/**
 * POST /api/agent/execute
 * Body: { command: string, history?: [{role, body}] }
 * Trả: { success, data: { message, actions[] } }
 */
export async function executeAgent(req, res) {
  const command = String(req.body?.command ?? "").trim();
  if (!command) throw new ApiError(400, "command is required");
  if (command.length > 500) throw new ApiError(400, "command quá dài");

  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [];
  const orgId = req.role?.OrganizationID ?? req.user?.OrganizationIDs?.[0] ?? null;

  const result = await runAgent({ command, history, orgId, userId: req.user?._id });
  res.json({ success: true, data: result });
}

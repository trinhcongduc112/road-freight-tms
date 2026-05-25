import { ApiError } from "../utils/apiError.js";
import { runAgent } from "../services/aiAgentService.js";

function parseAgentInput(req) {
  const command = String(req.body?.command ?? "").trim();
  if (!command) throw new ApiError(400, "command is required");
  if (command.length > 500) throw new ApiError(400, "command quá dài");
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [];
  const orgId = req.role?.OrganizationID ?? req.user?.OrganizationIDs?.[0] ?? null;
  const userId = req.user?._id ?? null;
  return { command, history, orgId, userId };
}

/**
 * POST /api/agent/execute
 * Body: { command: string, history?: [{role, body}] }
 * Trả: { success, data: { message, actions[] } }
 */
export async function executeAgent(req, res) {
  const input = parseAgentInput(req);
  const result = await runAgent(input);
  res.json({ success: true, data: result });
}

/**
 * POST /api/agent/stream
 * Body: { command, history? } — giống /execute.
 * Trả NDJSON (mỗi dòng 1 JSON event):
 *   { "type": "progress", "stage": "thinking"|"tool_call"|"tool_done"|"fallback", "label"?, "tool"? }
 *   { "type": "done", "data": { ok, message, actions, fallback? } }
 *   { "type": "error", "message" }
 * Frontend dùng fetch + ReadableStream — không cần EventSource (vốn không hỗ trợ POST + Auth header).
 */
export async function executeAgentStream(req, res) {
  const input = parseAgentInput(req);

  // NDJSON over chunked HTTP — nginx phải set proxy_buffering off (đã có trong frontend-web/nginx.conf cho /api/)
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering nếu có
  res.flushHeaders?.();

  const writeEvent = (obj) => {
    res.write(JSON.stringify(obj) + "\n");
  };

  writeEvent({ type: "progress", stage: "start", label: "Đang xử lý" });

  try {
    const result = await runAgent({
      ...input,
      onProgress: (evt) => writeEvent({ type: "progress", ...evt })
    });
    writeEvent({ type: "done", data: result });
  } catch (err) {
    writeEvent({ type: "error", message: err.message || "Agent error" });
  } finally {
    res.end();
  }
}

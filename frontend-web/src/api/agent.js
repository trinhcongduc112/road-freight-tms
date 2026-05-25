import { apiClient } from "./client";
import { useAuthStore } from "../store/authStore";

export const agentApi = {
  execute: (command, history = []) =>
    apiClient.post("/agent/execute", { command, history }),

  /**
   * Streaming variant — đọc NDJSON từ /agent/stream.
   * @param {string} command
   * @param {Array}  history
   * @param {(evt:{type:string, ...}) => void} onEvent
   * @returns {Promise<{ok:boolean, message:string, actions:Array}>}  resolved khi event "done" tới
   *
   * Dùng fetch + ReadableStream — axios không hỗ trợ stream trong browser.
   */
  async executeStream(command, history = [], onEvent = () => {}) {
    const baseURL = import.meta.env.VITE_API_URL ?? "/api";
    const token = useAuthStore.getState().token;

    const res = await fetch(`${baseURL}/agent/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ command, history })
    });

    if (!res.ok || !res.body) {
      throw new Error(`Stream failed: HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let final = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // NDJSON: tách theo \n, dòng cuối có thể chưa hoàn chỉnh — giữ lại
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const evt = JSON.parse(line);
          onEvent(evt);
          if (evt.type === "done") final = evt.data;
          if (evt.type === "error") throw new Error(evt.message);
        } catch (e) {
          // Bỏ qua dòng JSON lỗi (không nên xảy ra)
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }

    return final ?? { ok: false, message: "Stream kết thúc bất thường", actions: [] };
  }
};

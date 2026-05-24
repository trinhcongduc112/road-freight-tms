import { apiClient } from "./client";

export const agentApi = {
  execute: (command, history = []) =>
    apiClient.post("/agent/execute", { command, history })
};

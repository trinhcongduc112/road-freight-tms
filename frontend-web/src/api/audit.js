import { apiClient } from "./client";

export const auditApi = {
  list: (params = {}) => apiClient.get("/audit-logs", { params }).then((r) => r.data),
  summary: () => apiClient.get("/audit-logs/summary").then((r) => r.data)
};

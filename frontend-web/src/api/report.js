import { apiClient } from "./client";

export const reportApi = {
  summary: (params) => apiClient.get("/reports/summary", { params })
};

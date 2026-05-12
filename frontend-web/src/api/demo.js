import { apiClient } from "./client";

export const demoApi = {
  status: () => apiClient.get("/demo/status"),
  seed:   () => apiClient.post("/demo/seed"),
  clear:  () => apiClient.delete("/demo/clear")
};

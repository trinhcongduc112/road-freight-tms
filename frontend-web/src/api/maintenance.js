import { apiClient } from "./client";

export const maintenanceApi = {
  list: (params = {}) => apiClient.get("/maintenance", { params }).then((r) => r.data),
  alerts: () => apiClient.get("/maintenance/alerts").then((r) => r.data),
  create: (body) => apiClient.post("/maintenance", body).then((r) => r.data),
  update: (id, body) => apiClient.put(`/maintenance/${id}`, body).then((r) => r.data),
  remove: (id) => apiClient.delete(`/maintenance/${id}`).then((r) => r.data)
};

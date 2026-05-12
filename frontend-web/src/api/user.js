import { apiClient } from "./client";

export const userApi = {
  list: (params) => apiClient.get("/users", { params }),
  create: (payload) => apiClient.post("/users", payload),
  import: (payload) => apiClient.post("/users/import", payload),
  invite: (payload) => apiClient.post("/users/invite", payload),
  resendInvitation: (id) => apiClient.post(`/users/${id}/resend-invitation`),
  update: (id, payload) => apiClient.put(`/users/${id}`, payload),
  remove: (id) => apiClient.delete(`/users/${id}`)
};

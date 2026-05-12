import { apiClient } from "./client";

export const orderApi = {
  list: (params) => apiClient.get("/orders", { params }),
  get: (id) => apiClient.get(`/orders/${id}`),
  create: (payload) => apiClient.post("/orders/create", payload),
  update: (id, payload) => apiClient.put(`/orders/${id}`, payload),
  remove: (id) => apiClient.delete(`/orders/${id}`),
  changeStatus: (payload) => apiClient.post("/orders/change/status", payload),
  changePlanningStatus: (payload) => apiClient.post("/orders/change/planning-status", payload),
  allocate: (payload) => apiClient.post("/orders/allocate", payload),
  getAllocations: (id) => apiClient.get(`/orders/${id}/allocations`),
  upload: (formData) => apiClient.post("/orders/upload", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  approve: (payload) => apiClient.post("/orders/change/approval-status", payload)
};

import { apiClient } from "./client";

export const organizationApi = {
  list: () => apiClient.get("/organizations"),
  tree: () => apiClient.get("/organizations/tree"),
  get: (id) => apiClient.get(`/organizations/${id}`),
  create: (payload) => apiClient.post("/organizations", payload),
  import: (payload) => apiClient.post("/organizations/import", payload),
  update: (id, payload) => apiClient.put(`/organizations/${id}`, payload),
  remove: (id) => apiClient.delete(`/organizations/${id}`)
};

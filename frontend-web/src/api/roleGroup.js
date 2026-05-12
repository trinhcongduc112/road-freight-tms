import { apiClient } from "./client";

export const roleGroupApi = {
  catalog: () => apiClient.get("/role-groups/catalog"),
  list: (params) => apiClient.get("/role-groups", { params }),
  create: (payload) => apiClient.post("/role-groups", payload),
  import: (payload) => apiClient.post("/role-groups/import", payload),
  update: (id, payload) => apiClient.put(`/role-groups/${id}`, payload),
  remove: (id) => apiClient.delete(`/role-groups/${id}`)
};

import { apiClient } from "./client";

const base = "/master-data";

export const customerApi = {
  list: (params) => apiClient.get(`${base}/customers`, { params }),
  get: (id) => apiClient.get(`${base}/customers/${id}`),
  create: (payload) => apiClient.post(`${base}/customers`, payload),
  update: (id, payload) => apiClient.put(`${base}/customers/${id}`, payload),
  remove: (id) => apiClient.delete(`${base}/customers/${id}`),
  import: (payload) => apiClient.post(`${base}/customers/import`, payload)
};

export const productApi = {
  list: (params) => apiClient.get(`${base}/products`, { params }),
  get: (id) => apiClient.get(`${base}/products/${id}`),
  create: (payload) => apiClient.post(`${base}/products`, payload),
  update: (id, payload) => apiClient.put(`${base}/products/${id}`, payload),
  remove: (id) => apiClient.delete(`${base}/products/${id}`),
  import: (payload) => apiClient.post(`${base}/products/import`, payload)
};

export const vehicleApi = {
  list: (params) => apiClient.get(`${base}/vehicles`, { params }),
  get: (id) => apiClient.get(`${base}/vehicles/${id}`),
  create: (payload) => apiClient.post(`${base}/vehicles`, payload),
  update: (id, payload) => apiClient.put(`${base}/vehicles/${id}`, payload),
  remove: (id) => apiClient.delete(`${base}/vehicles/${id}`),
  import: (payload) => apiClient.post(`${base}/vehicles/import`, payload)
};

export const driverApi = {
  list: (params) => apiClient.get(`${base}/drivers`, { params }),
  get: (id) => apiClient.get(`${base}/drivers/${id}`),
  create: (payload) => apiClient.post(`${base}/drivers`, payload),
  update: (id, payload) => apiClient.put(`${base}/drivers/${id}`, payload),
  remove: (id) => apiClient.delete(`${base}/drivers/${id}`),
  import: (payload) => apiClient.post(`${base}/drivers/import`, payload)
};

export const serviceApi = {
  list: (params) => apiClient.get(`${base}/services`, { params }),
  get: (id) => apiClient.get(`${base}/services/${id}`),
  create: (payload) => apiClient.post(`${base}/services`, payload),
  update: (id, payload) => apiClient.put(`${base}/services/${id}`, payload),
  remove: (id) => apiClient.delete(`${base}/services/${id}`),
  import: (payload) => apiClient.post(`${base}/services/import`, payload)
};

export const customerGroupApi = {
  list: () => apiClient.get(`${base}/customer-groups`),
  create: (payload) => apiClient.post(`${base}/customer-groups`, payload),
  update: (id, payload) => apiClient.put(`${base}/customer-groups/${id}`, payload),
  remove: (id) => apiClient.delete(`${base}/customer-groups/${id}`),
  import: (payload) => apiClient.post(`${base}/customer-groups/import`, payload)
};

export const productCategoryApi = {
  list: (params) => apiClient.get(`${base}/product-categories`, { params }),
  get: (id) => apiClient.get(`${base}/product-categories/${id}`),
  create: (payload) => apiClient.post(`${base}/product-categories`, payload),
  update: (id, payload) => apiClient.put(`${base}/product-categories/${id}`, payload),
  remove: (id) => apiClient.delete(`${base}/product-categories/${id}`),
  import: (payload) => apiClient.post(`${base}/product-categories/import`, payload)
};

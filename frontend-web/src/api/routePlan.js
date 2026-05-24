import { apiClient } from "./client";

const base = "/route-plans";

export const routePlanApi = {
  list: (params) => apiClient.get(base, { params }),
  get: (id) => apiClient.get(`${base}/${id}`),
  create: (payload) => apiClient.post(base, payload),
  update: (id, payload) => apiClient.patch(`${base}/${id}`, payload),
  remove: (id) => apiClient.delete(`${base}/${id}`),

  listRoutes: (planId) => apiClient.get(`${base}/${planId}/routes`),
  addRoute: (planId, payload) => apiClient.post(`${base}/${planId}/routes`, payload),
  removeRoute: (planId, routeId) => apiClient.delete(`${base}/${planId}/routes/${routeId}`),

  addOrder: (planId, routeId, payload) => apiClient.post(`${base}/${planId}/routes/${routeId}/stops`, payload),
  removeOrder: (planId, routeId, orderId) => apiClient.delete(`${base}/${planId}/routes/${routeId}/orders/${orderId}`),

  moveOrder: (planId, payload) => apiClient.post(`${base}/${planId}/move-order`, payload),
  reorderOrder: (planId, payload) => apiClient.post(`${base}/${planId}/reorder-order`, payload),
  assignRoute: (planId, routeId, payload) => apiClient.patch(`${base}/${planId}/routes/${routeId}/assignment`, payload),

  lock: (planId, routeId) => apiClient.post(`${base}/${planId}/routes/${routeId}/lock`),
  unlock: (planId, routeId) => apiClient.post(`${base}/${planId}/routes/${routeId}/unlock`),
  finalize: (planId, routeId) => apiClient.post(`${base}/${planId}/routes/${routeId}/finalize`),

  unplannedOrders: (params) => apiClient.get(`${base}/unplanned-orders`, { params }),

  optimize: (planId) => apiClient.post(`${base}/${planId}/optimize`),
  autoDispatch: (planId, opts = {}) => apiClient.post(`${base}/${planId}/auto-dispatch`, opts)
};

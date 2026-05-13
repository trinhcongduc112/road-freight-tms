import { apiClient } from "./client";

export const tripApi = {
  list: (params) => apiClient.get("/trips", { params }),
  get: (id) => apiClient.get(`/trips/${id}`),
  syncPlan: (planId) => apiClient.post(`/trips/sync-plan/${planId}`)
};

export const driverAppApi = {
  listTrips: () => apiClient.get("/driver/trips"),
  getTrip: (id) => apiClient.get(`/driver/trips/${id}`),
  confirm: (id) => apiClient.post(`/driver/trips/${id}/confirm`),
  loading: (id) => apiClient.post(`/driver/trips/${id}/loading`),
  start: (id) => apiClient.post(`/driver/trips/${id}/start`),
  taskAction: (id, stopIndex, action, payload = {}) => apiClient.post(`/driver/trips/${id}/tasks/${stopIndex}/${action}`, payload),
  finish: (id) => apiClient.post(`/driver/trips/${id}/finish`),
  gps: (id, payload) => apiClient.post(`/driver/trips/${id}/gps`, payload)
};

import { apiClient } from "./client";

export const authApi = {
  login: (payload) => apiClient.post("/auth/login", payload),
  me:    ()        => apiClient.get("/auth/me"),
};

export const driverApi = {
  getRoutes:    ()          => apiClient.get("/driver/trips"),
  getRoute:     (id)        => apiClient.get(`/driver/trips/${id}`),
  confirmTrip:  (id)        => apiClient.post(`/driver/trips/${id}/confirm`),
  startLoading: (id)        => apiClient.post(`/driver/trips/${id}/loading`),
  startTrip:    (id)        => apiClient.post(`/driver/trips/${id}/start`),
  returnTrip:   (id)        => apiClient.post(`/driver/trips/${id}/return`),
  finishTrip:   (id)        => apiClient.post(`/driver/trips/${id}/finish`),
  updateStop:   (id, stopIndex, payload) =>
    apiClient.post(`/driver/trips/${id}/tasks/${stopIndex}/${payload.action ?? "complete"}`, payload),
};

import { apiClient } from "./client";

export const authApi = {
  login: (payload) => apiClient.post("/auth/login", payload),
  me:    ()        => apiClient.get("/auth/me"),
};

export const driverApi = {
  getRoutes:    ()              => apiClient.get("/driver/trips"),
  getRoute:     (id)            => apiClient.get(`/driver/trips/${id}`),
  confirmTrip:  (id, payload)   => apiClient.post(`/driver/trips/${id}/confirm`,  payload ?? {}),
  startLoading: (id, payload)   => apiClient.post(`/driver/trips/${id}/loading`,  payload ?? {}),
  startTrip:    (id, payload)   => apiClient.post(`/driver/trips/${id}/start`,    payload ?? {}),
  returnTrip:   (id, payload)   => apiClient.post(`/driver/trips/${id}/return`,   payload ?? {}),
  finishTrip:   (id, payload)   => apiClient.post(`/driver/trips/${id}/finish`,   payload ?? {}),
  updateStop:   (id, stopIndex, payload) =>
    apiClient.post(`/driver/trips/${id}/tasks/${stopIndex}/${payload.action ?? "complete"}`, payload),
  reportIncident: (id, payload) =>
    apiClient.post(`/driver/trips/${id}/incidents`, payload),
  getMessages: () =>
    apiClient.get("/driver/messages"),
  getTripMessages: (id) =>
    apiClient.get(`/driver/trips/${id}/messages`),
  sendTripMessage: (id, payload) =>
    apiClient.post(`/driver/trips/${id}/messages`, payload),
  postGps: (id, payload) =>
    apiClient.post(`/driver/trips/${id}/gps`, payload),
};

export const supportApi = {
  chatSession: () => apiClient.get("/support/chat/session"),
  chatMessage: (message, options = {}) =>
    apiClient.post("/support/chat/message", { message, ...options }),
  resumeBot: (sessionId) =>
    apiClient.post("/support/chat/resume-bot", { sessionId }),
};

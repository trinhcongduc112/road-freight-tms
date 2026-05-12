import { apiClient } from "./client";

export const authApi = {
  login: (payload) => apiClient.post("/auth/login", payload),
  me:    ()        => apiClient.get("/auth/me"),
};

export const driverApi = {
  getRoutes:    ()          => apiClient.get("/driver/routes"),
  getRoute:     (id)        => apiClient.get(`/driver/routes/${id}`),
  updateStop:   (id, stopIndex, payload) =>
    apiClient.post(`/driver/routes/${id}/stops/${stopIndex}/status`, payload),
};

import { apiClient } from "./client";

export const contactApi = {
  submit: (payload) => apiClient.post("/public/contact", payload)
};

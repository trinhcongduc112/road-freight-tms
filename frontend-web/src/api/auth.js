import { apiClient } from "./client";

export const authApi = {
  login: (payload) => apiClient.post("/auth/login", payload),
  register: (payload) => apiClient.post("/auth/register", payload),
  verifyEmail: (token) => apiClient.post("/auth/verify-email", { token }),
  resendVerification: (email) => apiClient.post("/auth/resend-verification", { email }),
  forgotPassword: (email) => apiClient.post("/auth/forgot-password", { email }),
  resetPassword: (payload) => apiClient.post("/auth/reset-password", payload),
  acceptInvitation: (payload) => apiClient.post("/auth/accept-invitation", payload),
  me: () => apiClient.get("/auth/me"),
  logout: () => apiClient.post("/auth/logout")
};

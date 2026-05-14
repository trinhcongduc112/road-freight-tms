import { apiClient } from "./client";

const base = "/support";

export const supportApi = {
  chatSession: (sessionId) => apiClient.get(`${base}/chat/session`, { params: sessionId ? { sessionId } : {} }),
  chatMessage: (message, options = {}) => apiClient.post(`${base}/chat/message`, { message, ...options }),
  adminChatSessions: (params = {}) => apiClient.get(`${base}/admin/chat-sessions`, { params }),
  adminChatReply: (sessionId, message) => apiClient.post(`${base}/admin/chat-sessions/${sessionId}/reply`, { message }),
  ask: (message, options = {}) => apiClient.post(`${base}/ask`, { message, ...options }),
  tickets: () => apiClient.get(`${base}/tickets`),
  sendMessage: (ticketId, message) => apiClient.post(`${base}/tickets/${ticketId}/messages`, { message }),
  adminTickets: () => apiClient.get(`${base}/admin/tickets`),
  adminReply: (ticketId, message) => apiClient.post(`${base}/admin/tickets/${ticketId}/reply`, { message }),
  adminLearn: (ticketId) => apiClient.post(`${base}/admin/tickets/${ticketId}/learn`),
  seedDefaults: () => apiClient.post(`${base}/admin/articles/seed-defaults`)
};

import { apiClient } from "./client";

const base = "/support";

export const supportApi = {
  chatSession: (sessionId) => apiClient.get(`${base}/chat/session`, { params: sessionId ? { sessionId } : {} }),
  chatMessage: (message, options = {}) => apiClient.post(`${base}/chat/message`, { message, ...options }),
  resumeBot: (sessionId) => apiClient.post(`${base}/chat/resume-bot`, { sessionId }),
  replyContext: (token) => apiClient.get(`${base}/reply-context`, { params: { token } }),
  submitReply: ({ token, message, agentName }) => apiClient.post(`${base}/reply`, { token, message, agentName })
};

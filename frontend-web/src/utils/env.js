const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

export const env = {
  apiUrl: apiBase,
  socketUrl: apiBase.replace("/api", "")
};

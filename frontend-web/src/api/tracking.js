import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "/api";

/**
 * Public tracking — không cần auth. Dùng axios trực tiếp (không qua apiClient
 * vì interceptor sẽ cố refresh khi 401, không phù hợp với public endpoint).
 */
export async function trackByOrderCode(orderCode) {
  const res = await axios.get(`${baseURL}/track/${encodeURIComponent(orderCode)}`);
  return res.data?.data;
}

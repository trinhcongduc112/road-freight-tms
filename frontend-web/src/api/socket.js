import { io } from "socket.io-client";
import { useAuthStore } from "../store/authStore";
import { env } from "../utils/env";

let socket = null;
let activeToken = null;

export function getSocket() {
  const token = useAuthStore.getState().token;
  if (!token) return null;
  if (socket && activeToken === token) return socket;
  if (socket) socket.disconnect();
  activeToken = token;
  socket = io(env.socketUrl, {
    auth: { token },
    transports: ["websocket", "polling"]
  });
  return socket;
}

export function closeSocket() {
  if (socket) socket.disconnect();
  socket = null;
  activeToken = null;
}

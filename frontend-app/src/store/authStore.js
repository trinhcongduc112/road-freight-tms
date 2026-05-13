import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "rft_driver_token";
const REMEMBER_KEY = "rft_driver_remember";

export const useAuthStore = create((set, get) => ({
  token: null,
  user:  null,
  savedLogin: null,
  hydrated: false,

  // Khôi phục token từ secure storage khi app mở
  hydrate: async () => {
    try {
      const [token, saved] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(REMEMBER_KEY),
      ]);
      set({
        token: token || null,
        savedLogin: saved ? JSON.parse(saved) : null,
        hydrated: true
      });
    } catch {
      set({ hydrated: true });
    }
  },

  setSession: async ({ token, user, remember, email, password }) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    if (remember) {
      await SecureStore.setItemAsync(REMEMBER_KEY, JSON.stringify({ email, password }));
      set({ savedLogin: { email, password } });
    } else {
      await SecureStore.deleteItemAsync(REMEMBER_KEY);
      set({ savedLogin: null });
    }
    set({ token, user });
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, user: null });
  },
}));

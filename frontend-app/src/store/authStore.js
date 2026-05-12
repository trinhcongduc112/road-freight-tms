import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "rft_driver_token";

export const useAuthStore = create((set, get) => ({
  token: null,
  user:  null,
  hydrated: false,

  // Khôi phục token từ secure storage khi app mở
  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) set({ token, hydrated: true });
      else set({ hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  setSession: async ({ token, user }) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token, user });
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, user: null });
  },
}));

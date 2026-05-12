import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set) => ({
      token:        null,
      refreshToken: null,   // ← Abivin pattern: lưu cả 2 token
      user:         null,
      role:         null,

      setSession: ({ token, refreshToken, user, role }) =>
        set({ token, refreshToken: refreshToken ?? null, user, role: role ?? null }),

      // Chỉ update access token (sau khi refresh)
      setToken: (token) => set({ token }),

      logout: () => set({ token: null, refreshToken: null, user: null, role: null })
    }),
    {
      name: "road-freight-auth"
    }
  )
);

export const selectIsAuthenticated = (s) => Boolean(s.token);

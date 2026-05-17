/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY || "http://localhost:5000",
          changeOrigin: true
        }
      }
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.js"],
      css: false,
      coverage: {
        provider: "v8",
        reporter: ["text", "text-summary", "html"],
        include: ["src/**/*.{js,jsx}"],
        exclude: ["src/test/**", "src/**/*.test.{js,jsx}", "src/main.jsx"]
      }
    }
  };
});

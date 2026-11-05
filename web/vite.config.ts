import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/crm/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/crm/api": {
        target: process.env.CRM_API ?? "http://127.0.0.1:5330",
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,
  },
  resolve: {
    dedupe: ["react-router", "react-router-dom"],
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});

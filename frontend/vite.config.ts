import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const backend = "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": backend,
      "/token": backend,
      "/profiles": backend,
      "/analyze": backend,
      "/ask": backend,
      "/review": backend,
      "/health": backend,
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("three") || id.includes("@react-three")) {
            return "three";
          }
          if (
            id.includes("recharts") ||
            id.includes("victory-vendor") ||
            id.includes("d3-")
          ) {
            return "charts";
          }
          if (
            /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(
              id,
            )
          ) {
            return "react";
          }
          if (
            id.includes("@tanstack") ||
            id.includes("lucide-react") ||
            id.includes("motion")
          ) {
            return "ui";
          }
          return "vendor";
        },
      },
    },
  },
});

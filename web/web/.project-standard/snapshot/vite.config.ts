import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src"
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api/v1/auth/login": {
        target: "http://192.168.11.18:30054",
        changeOrigin: true
      },
      "/api/v1/users": {
        target: "http://192.168.11.18:30021",
        changeOrigin: true
      }
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 4173
  },
  build: {
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/react-router")) {
            return "react";
          }
          if (id.includes("node_modules/antd") || id.includes("node_modules/@ant-design")) {
            return "antd";
          }
          if (id.includes("node_modules/@tanstack")) {
            return "query";
          }
          return undefined;
        }
      }
    }
  }
});

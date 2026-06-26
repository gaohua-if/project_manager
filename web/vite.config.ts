import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const hmrHost = process.env.VITE_DEV_HMR_HOST ?? "192.168.28.25";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
      "@toast-ui/editor/viewer": fileURLToPath(
        new URL("./node_modules/@toast-ui/editor/dist/esm/indexViewer.js", import.meta.url)
      ),
      "@toast-ui/editor/toastui-editor-viewer.css": fileURLToPath(
        new URL("./node_modules/@toast-ui/editor/dist/toastui-editor-viewer.css", import.meta.url)
      )
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      host: hmrHost
    },
    proxy: {
      "/api/v1": {
        target: "http://127.0.0.1:18090",
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
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react-router")
          ) {
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

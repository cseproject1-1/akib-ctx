import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [
      "akib-ctx.onrender.com",
      "akib-ctx-1.onrender.com",
      "akib-ctx.pro.bd"
    ],
    hmr: {
      overlay: false,
    },
  },
  preview: {
    host: true,
    port: 8080,
    allowedHosts: [
      "akib-ctx.onrender.com",
      "akib-ctx-1.onrender.com",
      "akib-ctx.pro.bd"
    ],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

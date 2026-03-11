import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

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
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.png', 'robots.txt', 'pwa-192x192.png', 'pwa-512x512.png'],
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // Increase to 6MB
      },
      manifest: {
        name: 'CTXNote - Multi-Dimensional Knowledge Base',
        short_name: 'CTXNote',
        description: 'Next-gen non-linear knowledge base for visual thinkers and teams.',
        theme_color: '#3b82f6',
        background_color: '#0a0a0a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        id: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    }),
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'vendor-react': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          'vendor-icons': ['lucide-react'],
          'vendor-ui': ['framer-motion', 'clsx', 'tailwind-merge'],
          'vendor-canvas': ['@xyflow/react'],
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  }
}));

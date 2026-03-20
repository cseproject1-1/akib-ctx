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
      includeAssets: ['favicon.png', 'logo.png', 'robots.txt', 'pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png'],
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // Increase to 10MB for premium assets
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
      manifest: {
        name: 'CtxNote - Visual Knowledge Base & Infinite Canvas',
        short_name: 'CtxNote',
        description: 'Non-linear knowledge base for creating and organizing notes on an infinite canvas with offline support.',
        theme_color: '#0f172a',
        background_color: '#020617',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        scope: '/',
        start_url: '/',
        orientation: 'any',
        id: '/',
        categories: ['productivity', 'business', 'education', 'utilities'],
        shortcuts: [
          {
            name: 'New Note',
            short_name: 'New',
            description: 'Create a new node quickly',
            url: '/?action=new-node',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'View Workspaces',
            short_name: 'Dashboard',
            description: 'Back to your dashboard',
            url: '/',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Mobile Dashboard',
            short_name: 'Mobile',
            description: 'Mobile-optimized dashboard',
            url: '/mobile-mode',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }]
          }
        ],
        screenshots: [
          {
            src: '/screenshots/desktop.png',
            sizes: '1920x1080',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Powerful Multi-Dimensional Canvas'
          },
          {
            src: '/screenshots/mobile.png',
            sizes: '1080x1920',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Mobile Knowledge Access'
          }
        ],
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
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any'
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
          'vendor-react': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', '@tanstack/react-table'],
          'vendor-icons': ['lucide-react'],
          'vendor-ui': ['framer-motion', 'clsx', 'tailwind-merge', 'cmdk'],
          'vendor-canvas': ['@xyflow/react'],
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  }
}));

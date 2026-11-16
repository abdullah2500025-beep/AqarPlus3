import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app-icon.svg', 'assets/aistudio/Aqar_plus_8de53ba4.svg'],
      manifest: {
        name: 'AqarPlus – نظام إدارة الأملاك والعقارات',
        short_name: 'AqarPlus',
        description:
          'منظومة مركزية متكاملة لإدارة الأملاك والعقارات والتأجير والتحصيل والمحاسبة والصيانة والعمل دون إنترنت.',
        theme_color: '#26478D',
        background_color: '#0A0E1A',
        display: 'standalone',
        dir: 'rtl',
        lang: 'ar',
        start_url: './',
        icons: [
          {
            src: './app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: './assets/aistudio/Aqar_plus_8de53ba4.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'aqarplus-google-fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});

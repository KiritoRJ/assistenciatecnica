import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {},
      },
      plugins: [
        react(),
      VitePWA({
          registerType: 'autoUpdate',
          injectRegister: null, // Disable auto injection, we handle it in index.tsx
          includeAssets: ['icon.svg'],
          strategies: 'generateSW',
          filename: 'sw.js',
          workbox: {
            globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
            cleanupOutdatedCaches: true,
            clientsClaim: true,
            skipWaiting: true,
            navigateFallback: 'index.html',
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
          },
          manifest: {
            name: 'Lojas Cloud',
            short_name: 'Lojas Cloud',
            description: 'Sistema de Gestão lojas profissional',
            theme_color: '#2563eb',
            background_color: '#ffffff',
            display: 'standalone',
            orientation: 'portrait',
            start_url: '/',
            scope: '/',
            id: '/',
            icons: [
              {
                src: 'icon.svg',
                sizes: '192x192',
                type: 'image/svg+xml',
                purpose: 'any'
              },
              {
                src: 'icon.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
                purpose: 'any'
              },
              {
                src: 'icon.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
                purpose: 'maskable'
              }
            ]
          },
          devOptions: {
            enabled: false,
            /* type: 'module', // Removed to use classic worker for compatibility */
            navigateFallback: 'index.html',
          }
        })
      ],

      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        sourcemap: false,
        rollupOptions: {
          external: [
            'react',
            'react-dom',
            'react/jsx-runtime',
            'react-router-dom',
            'lucide-react',
            'recharts',
            'jspdf',
            '@supabase/supabase-js',
            'html5-qrcode'
          ]
        }
      }
    };
});

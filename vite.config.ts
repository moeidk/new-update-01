import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Build metadata written by scripts/generate-version.js (baked into the bundle for update checks). */
function readBuildInfo() {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, 'public/version.json'), 'utf8'));
  } catch {
    return {
      version: '0.0.0',
      buildTime: new Date().toISOString(),
      gitCommit: 'dev',
      gitBranch: 'local',
      environment: 'development',
      releaseName: 'KeepPass (dev)',
    };
  }
}

export default defineConfig(() => {
  return {
    define: {
      __APP_BUILD__: JSON.stringify(readBuildInfo()),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // 'prompt': a new deploy shows the in-app update banner; the user chooses when to reload.
        registerType: 'prompt',
        injectRegister: false, // registered in src/services/updateDetector.ts
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'KeepPass Vault | گاوصندوق امن رمزها',
          short_name: 'KeepPass',
          description: 'گاوصندوق امن مدیریت رمزها با ورود بیومتریک فیس‌آیدی، اثر انگشت، رمز عبور و پشتیبانی نصب روی آیفون',
          theme_color: '#0B0F1A',
          background_color: '#0B0F1A',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          // Never serve the SPA shell for API calls or the version file.
          navigateFallbackDenylist: [/^\/api\//, /^\/version\.json/],
          cleanupOutdatedCaches: true,
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      // API routes are served by the Cloudflare Worker: run `npm run dev:api` alongside `npm run dev`.
      proxy: {
        '/api': 'http://127.0.0.1:8787',
      },
    },
    build: {
      chunkSizeWarningLimit: 800,
    },
  };
});

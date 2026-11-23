import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base './' чтобы приложение работало и с корня домена, и из подпапки
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2,mjs}'], maximumFileSizeToCacheInBytes: 5_000_000 },
      manifest: {
        name: 'Лайф Сити',
        short_name: 'Лайф Сити',
        description: 'Личный город: работа, календарь, цели, привычки, деньги, второй мозг',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#FBEDE4',
        theme_color: '#F7C3C6',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
});

import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the app under the repo name; base, manifest scope/start_url and the SW scope
// must all agree on it.
const BASE = '/imgly/'

export default defineConfig({
  base: BASE,
  build: {
    // The update e2e (pwa-install-update) serves a second build whose hashed files all have new
    // URLs, as a deploy to Pages makes them; the shipped build always uses `assets`.
    assetsDir: process.env.VITE_E2E_BUILD === 'B' ? 'assets-b' : 'assets',
  },
  plugins: [
    vue(),
    VitePWA({
      // A new version waits as a waiting worker until the Editor chooses "Reload" (pwa-install-update
      // ADR-0001), so there is no skipWaiting: the browser activates it once every window closed.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'imgly editor',
        short_name: 'imgly',
        description: 'A client-only image editor that works offline.',
        scope: BASE,
        start_url: BASE,
        display: 'standalone',
        // The dark --color-titlebar, shown until the page's theme-color tags apply (ADR-0002).
        background_color: '#15122A',
        theme_color: '#15122A',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: `${BASE}index.html`,
        clientsClaim: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})

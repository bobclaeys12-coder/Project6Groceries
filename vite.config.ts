import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Moet exact overeenkomen met de GitHub-repositorynaam, anders breken de
// asset-paden en de service worker op GitHub Pages.
const BASE = '/Project6Groceries/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        id: BASE,
        name: 'Recepten & Boodschappen',
        short_name: 'Boodschappen',
        description:
          'Persoonlijke recepten, boodschappenlijst en voorraad. Werkt offline, data blijft op je toestel.',
        lang: 'nl-BE',
        dir: 'ltr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#faf8f5',
        theme_color: '#2e7d32',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
        // De app is volledig lokaal; er is geen enkele runtime-API om te cachen.
        runtimeCaching: [],
      },
      // Service worker uit tijdens `npm run dev` (voorkomt verouderde modules).
      // Offline testen doe je met `npm run build && npm run preview`.
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})

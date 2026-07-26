import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const APP_NAME = 'Pocketary'
const APP_DESCRIPTION =
  'Every medication you take, in one pocket. Track your NHS, private and over-the-counter medicines, spot potential interactions, and share a clear summary with your GP.'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    strictPort: true,
    // Honor the port assigned by the harness (PORT env), falling back to 5173.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        description: APP_DESCRIPTION,
        // Matches background_color and the <meta name="theme-color"> in
        // index.html. These three used to disagree, so an installed PWA showed
        // a teal splash opening into a cream app.
        theme_color: '#F7F7F4',
        background_color: '#F7F7F4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
      },
      devOptions: { enabled: false },
    }),
  ],
})

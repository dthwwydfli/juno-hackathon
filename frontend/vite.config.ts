import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

function assertProductionApiBaseUrl(): void {
  if (process.env.VERCEL !== '1') return
  const api = (process.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '')
  if (!api) {
    throw new Error(
      'VITE_API_BASE_URL must be set in Vercel → Settings → Environment Variables before deploy (HTTPS API URL, not localhost).',
    )
  }
  if (/localhost|127\.0\.0\.1/i.test(api)) {
    throw new Error(
      `VITE_API_BASE_URL is "${api}" — Vercel builds cannot call localhost. Use an HTTPS tunnel or hosted API URL.`,
    )
  }
  const pdfOrigin = (process.env.VITE_PUBLIC_PDF_ORIGIN ?? '').trim().replace(/\/$/, '')
  if (!pdfOrigin) return
  const pdfHost = hostnameOf(pdfOrigin)
  const apiHost = hostnameOf(api)
  if (pdfHost?.endsWith('.loca.lt')) {
    throw new Error(
      `VITE_PUBLIC_PDF_ORIGIN is "${pdfOrigin}" — remove it or set it to the same URL as VITE_API_BASE_URL for Vercel production.`,
    )
  }
  if (pdfHost && apiHost && pdfHost !== apiHost) {
    throw new Error(
      `VITE_PUBLIC_PDF_ORIGIN (${pdfOrigin}) must match VITE_API_BASE_URL (${api}) so GP share links load PDFs from the API that created the token.`,
    )
  }
}

assertProductionApiBaseUrl()

const APP_NAME = 'Pocketary'
const APP_DESCRIPTION =
  'Every medicine and supplement, in one pocket. Track your NHS, private and over-the-counter medicines, spot potential interactions, and share a clear summary with your GP.'

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
        // The landing story PNGs (~6.8 MB) and the pdf.js worker (~2.2 MB) used
        // to be precached, so a phone's first visit pulled ~9 MB in the
        // background — often on cellular — to render a page that needs none of
        // it. Both are fetched on demand instead; the images then cache on
        // first view via the runtime rule below.
        globIgnores: ['**/landing/*.png', '**/pdf.worker-*.mjs'],
        runtimeCaching: [
          {
            urlPattern: /\/landing\/.*\.png$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'landing-images',
              expiration: { maxEntries: 12 },
            },
          },
        ],
        navigateFallback: '/index.html',
        // /gp/ is denied so GP share links always resolve over the network. Served from
        // precache they render whatever bundle the phone last cached, and a bundle that
        // predates the /gp/ route degrades to the landing page instead of failing loudly.
        navigateFallbackDenylist: [/\.[^/]+$/, /^\/assets\//, /^\/gp\//],
      },
      devOptions: { enabled: false },
    }),
  ],
})

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_BASE_URL || 'http://localhost:3000'
  const apiProxy = {
    '/api': {
      target: apiTarget,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api/, ''),
    },
  }

  return {
    plugins: [
      vue(),
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        registerType: 'prompt',
        srcDir: 'src',
        filename: 'service-worker.ts',
        devOptions: {
          enabled: true,
          type: 'module',
        },
        includeAssets: ['pwa/cat-icon.svg', 'pwa/apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'ChatChoi',
          short_name: 'ChatChoi',
          description: 'Ứng dụng nhắn tin thời gian thực.',
          lang: 'vi',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#fffbff',
          theme_color: '#6750a4',
          icons: [
            {
              src: '/pwa/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/pwa/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/pwa/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    cacheDir: 'node_modules/.vite',
    server: {
      host: '0.0.0.0',
      allowedHosts: ['dangtuankhai.id.vn', 'chat.dangtuankhai.id.vn'],
      proxy: apiProxy,
    },
    preview: {
      host: '0.0.0.0',
      allowedHosts: ['dangtuankhai.id.vn', 'chat.dangtuankhai.id.vn'],
      proxy: apiProxy,
    },
  }
})

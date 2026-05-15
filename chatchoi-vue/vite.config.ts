import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  cacheDir: 'node_modules/.vite',
  server: {
    host: '0.0.0.0',
    allowedHosts: ['dangtuankhai.id.vn'],
  },
})

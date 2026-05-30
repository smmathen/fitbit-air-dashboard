import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Forwards /api/health/* → https://health.googleapis.com/v4/* (avoids browser CORS) */
const healthApiProxy = {
  target: 'https://health.googleapis.com',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/api\/health/, '/v4'),
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api/health': healthApiProxy,
    },
  },
  preview: {
    port: 3000,
    proxy: {
      '/api/health': healthApiProxy,
    },
  },
})

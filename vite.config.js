import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Proxy API calls to avoid CORS issues in dev
    proxy: {
      '/api/health': {
        target: 'https://health.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/health/, '')
      }
    }
  }
})

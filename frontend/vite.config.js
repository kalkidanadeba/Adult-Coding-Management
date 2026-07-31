import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = env.VITE_API_URL || 'http://localhost:3000/api'

  const hasAbsoluteApiBase = /^https?:\/\//i.test(apiBase)
  const target = (hasAbsoluteApiBase ? apiBase : 'http://localhost:3000').replace(/\/api\/?$/, '')

  const proxy = {
    '/api': {
      target,
      changeOrigin: true,
      secure: false,
    },
    '/uploads': {
      target,
      changeOrigin: true,
      secure: false,
    },
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { proxy },
    preview: { proxy },
  }
})

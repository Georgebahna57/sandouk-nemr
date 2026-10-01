import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Connect } from 'vite'
import { defineConfig } from 'vite'
import { handleApi } from './server/router.mjs'

function attach(middlewares: Connect.Server) {
  middlewares.use(async (req, res, next) => {
    if (!req.url?.startsWith('/api/')) return next()
    try {
      const url = new URL(req.url, 'http://localhost')
      const result = await handleApi(url.pathname, url.searchParams)
      if (!result) return next()
      res.statusCode = result.status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(result.body))
    } catch (error) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'خطأ' }))
    }
  })
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'gold-fx-api',
      configureServer(server) {
        attach(server.middlewares)
      },
      configurePreviewServer(server) {
        attach(server.middlewares)
      },
    },
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: { port: 3003, host: '0.0.0.0' },
  preview: { port: 3003, host: '0.0.0.0' },
})

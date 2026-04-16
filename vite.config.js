import os from 'node:os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Print URLs your phone can open (same Wi‑Fi). */
function logLanUrls() {
  return {
    name: 'worksphere-log-lan-urls',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address()
        const port = typeof addr === 'object' && addr ? addr.port : 5173
        const lines = []
        const nets = os.networkInterfaces()
        for (const list of Object.values(nets)) {
          for (const net of list || []) {
            if (net.family === 'IPv4' && !net.internal) {
              lines.push(`  http://${net.address}:${port}`)
            }
          }
        }
        if (lines.length) {
          server.config.logger.info(
            `\n  workSphere — open on your phone (same Wi‑Fi):\n${lines.join('\n')}\n`,
          )
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), logLanUrls()],
  server: {
    // Listen on all interfaces; without allowedHosts, Vite blocks Host: 192.168.x.x (phone would get "not allowed").
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: false,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})

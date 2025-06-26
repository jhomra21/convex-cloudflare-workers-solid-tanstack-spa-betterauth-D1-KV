import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { resolve } from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: 'solid', autoCodeSplitting: true }),
    solidPlugin(),
    tailwindcss(),
    cloudflare(),
  ],
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'tools': ['@tanstack/solid-query', 'solid-transition-group', '@tanstack/solid-router-devtools', '@kobalte/core'],
        },
      },
    },
  },
})

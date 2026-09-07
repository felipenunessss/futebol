import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@motor" aponta pro motor/dados de ../src (o mesmo código usado pela CLI/testes,
    // ver web/src/data/browserLoaders.ts pro único trecho que precisa de uma versão
    // diferente — os loaders baseados em node:fs não rodam no navegador).
    alias: {
      '@motor': path.resolve(__dirname, '../src'),
    },
  },
})

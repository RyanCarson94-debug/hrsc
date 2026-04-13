import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/taxonomy-manager/',
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  build: {
    outDir: '../dist/taxonomy-manager',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/taxonomy-api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
})

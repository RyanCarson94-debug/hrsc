import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  base: '/knowledge/',
  build: {
    outDir: '../dist/knowledge',
    emptyOutDir: true,
  }
})

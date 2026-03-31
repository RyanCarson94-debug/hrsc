import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  base: '/law-monitor/',
  build: {
    outDir: '../dist/law-monitor',
    emptyOutDir: true,
  }
})

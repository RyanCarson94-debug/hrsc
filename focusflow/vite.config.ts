import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/focusflow/',
  build: {
    outDir: '../dist/focusflow',
    emptyOutDir: true,
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/csp-calculator/',
  build: {
    outDir: 'dist/csp-calculator',
    rollupOptions: {
      input: 'src/csp-calculator/index.html',
    }
  }
})
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages serves from /Transaction-Mapping-Dashboard/
  // Change to base: '/' if deploying to a custom domain or root path
  base: '/Transaction-Mapping-Dashboard/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
})

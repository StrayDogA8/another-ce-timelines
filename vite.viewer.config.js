import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Separate output so the viewer never enters the Electron installer
// (electron-builder only packages dist/** and electron/**)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist-viewer',
    rollupOptions: {
      input: fileURLToPath(new URL('./viewer.html', import.meta.url)),
    },
  },
  server: {
    port: 5184,
    strictPort: true,
    open: '/viewer.html',
  },
})

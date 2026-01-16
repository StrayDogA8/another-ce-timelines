import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom plugin to handle .timeline files as JSON
const timelinePlugin = {
  name: 'timeline-loader',
  transform(src, id) {
    if (id.endsWith('.timeline')) {
      return {
        code: `export default ${src}`,
        map: null
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), timelinePlugin],
})

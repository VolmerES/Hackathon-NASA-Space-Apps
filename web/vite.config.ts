import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Stamps the data URLs (src/data/version.ts), so a new build never reads a cached old data file.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
})

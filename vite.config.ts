import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // SPA fallback: serve index.html for all routes (including /delete-account)
  appType: 'spa',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
  },
})

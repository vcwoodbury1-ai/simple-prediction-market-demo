import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standard Vite + React config. The dev server runs on port 5173
// by default, separate from Flask's port 5000.
//
// The proxy below forwards any /api/... request from the dev server
// to Flask during local development, so the frontend can use a
// relative '/api' base URL everywhere (both locally and in
// production) instead of hardcoding a host/port.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
})

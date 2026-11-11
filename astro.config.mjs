// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      // In local dev (`pnpm dev`), proxy API calls straight to the Spring Boot backend so the
      // frontend can always call relative /api/... paths — the same paths that work through
      // nginx in docker-compose — without needing CORS configured on the backend at all.
      proxy: {
        '/api': {
          target: process.env.BACKEND_URL ?? 'http://localhost:8080',
          changeOrigin: true
        }
      }
    }
  }
});

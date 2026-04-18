import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3456',
      '/ws': {
        target: 'http://localhost:3456',
        ws: true,
      },
    },
  },
  // Relative asset paths so the same build works at http://localhost:3456/
  // (served by the local server) and at https://hemingweight.vercel.app/direct/
  // (copied into site/direct/ for the demo-mode landing).
  base: './',
  build: {
    outDir: 'dist',
  },
});

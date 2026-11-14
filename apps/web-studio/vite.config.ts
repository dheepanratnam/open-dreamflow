import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    copyPublicDir: process.env.VITE_SKIP_PUBLIC_MEDIA !== '1',
  },
  server: {
    port: 8789,
    host: true,
  },
  preview: {
    port: 8789,
    host: true,
  },
});

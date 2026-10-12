import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths: the report must work from file://, a subdirectory
  // on a static host, or the `beacon open` server alike.
  base: './',
  plugins: [react(), tailwindcss()],
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';

// The game is entirely client-side. Pages receives an actual static index,
// independent of the server bundle used by the Sites preview.
export default defineConfig({
  base: '/w25-signal/',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: 'dist/pages', target: 'safari16.4' },
});

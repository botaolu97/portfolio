import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { mubuContent } from './vite-plugin-mubu-content.ts';

export default defineConfig({
  // GitHub Pages serves project sites under /<repo>/; CI sets MUBU_BASE accordingly.
  base: process.env.MUBU_BASE ?? '/',
  plugins: [react(), mubuContent()],
  define: {
    // Changes with every build; added to demo URLs so a deploy never serves stale demo pages from
    // the browser cache (GitHub Pages caches files for 10 minutes).
    __MUBU_BUILD__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 8) ?? Date.now().toString(36)),
  },
  build: {
    // React + React Flow + zod are one ~160 kB (gzip) chunk; the editor is excluded from builds.
    chunkSizeWarningLimit: 600,
  },
  server: {
    // Saving a map writes into public/content; don't reload the page when that happens.
    watch: { ignored: ['**/public/content/**'] },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});

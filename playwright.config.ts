import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    actionTimeout: 5000,
  },
  projects: [
    { name: 'edit', testMatch: 'edit.spec.ts', use: { baseURL: 'http://127.0.0.1:5173' } },
    { name: 'view', testMatch: 'view.spec.ts', use: { baseURL: 'http://127.0.0.1:4173' } },
  ],
  webServer: [
    { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
    {
      // Always build fresh: a reused preview server would test whatever build it started with.
      // `exec` lets Playwright stop vite itself instead of leaving it orphaned behind npm.
      command: 'npm run build && exec npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});

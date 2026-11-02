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
      command: 'npm run build && npm run preview',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});

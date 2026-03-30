import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:43210',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev --workspace apps/web -- --port 43210',
    port: 43210,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Načteme .env.test, aby Playwright měl přístup k proměnným
 */
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

export default defineConfig({
  testDir: './e2e-tests',
  /* Spouštět testy paralelně? Pro DB testy raději false, aby se nehádaly o data */
  fullyParallel: false,
  /* Failni hned, když se něco pokazí (na CI) */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // DŮLEŽITÉ: Pouze 1 worker, jinak si testy budou mazat data pod rukama!
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  /* Nastavení lokálního serveru pro testy */
  webServer: {
    // Tady je ten trik: Nutíme Next.js použít .env.test
    command: 'npx dotenv -e .env.test -- npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
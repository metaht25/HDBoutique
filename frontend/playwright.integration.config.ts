import { defineConfig, devices } from '@playwright/test'

if (process.env.HDB_FASTAPI_TARGET !== 'http://api:8000') {
  throw new Error('Connected tests require the canonical synthetic Compose API target.')
}

export default defineConfig({
  testDir: './tests/integration', fullyParallel: false, workers: 1, retries: 0, forbidOnly: true,
  reporter: 'list', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 30000 },
})

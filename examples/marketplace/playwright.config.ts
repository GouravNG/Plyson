import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  timeout: 30000,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never', port: 5001 }]],
  use: {
    trace: 'on',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /plyson\.setup\.ts/,
      teardown: 'teardown',
    },
    {
      name: 'teardown',
      testMatch: /plyson\.teardown\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testMatch: /plyson\.spec\.ts/,
    },
  ],
})

import { defineConfig } from '@playwright/test'

export default defineConfig({
  timeout: 30000,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never', port: 5001 }]],
  use: {
    trace: 'on',
  },
})

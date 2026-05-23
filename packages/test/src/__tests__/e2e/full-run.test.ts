import { expect, test } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import { ProjectLoader } from '../../core/project-loader.js'
import { registerSuites } from '../../core/test-runner.js'
import { VariableStore } from '../../core/variable-store.js'
import { createMockServer, MockServer } from './mock-server.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let server: MockServer

test.beforeAll(async () => {
  // Use port 3000 as configured in test.env.json
  server = await createMockServer(3000)
})

test.afterAll(async () => {
  if (server) {
    await server.close()
  }
})

const rootDir = path.resolve(__dirname, '../fixtures/e2e-project')
const loader = new ProjectLoader()
const store = new VariableStore()

// Load the project graph and register the suites
// Playwright discovery will pick up the tests registered by registerSuites
const graph = await loader.load(rootDir, 'test')
registerSuites(graph, store, test, expect)

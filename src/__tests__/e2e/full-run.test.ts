import { test } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import { ProjectLoader } from '../../core/project-loader'
import { registerSuites } from '../../core/test-runner'
import { VariableStore } from '../../core/variable-store'
import { registerBuiltins } from '../../generators/registry'
import { createMockServer, MockServer } from './mock-server'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let server: MockServer

test.beforeAll(async () => {
  registerBuiltins()
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
registerSuites(graph, store)

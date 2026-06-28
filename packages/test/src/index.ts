import type { APIRequestContext, Expect, TestType } from '@playwright/test'
import * as fs from 'fs/promises'
import * as path from 'path'
import { ProjectLoader } from './core/project-loader.js'
import { registerSuites, runSteps } from './core/test-runner.js'
import { VariableStore } from './core/variable-store.js'
import { ConsoleLogger } from './core/logger.js'
import { resolvePhase1 } from './core/resolver.js'
import { AssertionEngine } from './core/assertion-engine.js'

export { ProjectLoader } from './core/project-loader.js'
export type { ProjectGraph } from './core/project-loader.js'
export { registerSuites } from './core/test-runner.js'
export { VariableStore } from './core/variable-store.js'
export * from './errors/index.js'

const STATE_DIR = '.plyson'
const STATE_FILE = 'state.json'

/**
 * Bootstraps the plyson project and registers all suites as Playwright tests.
 * This should be called from a Playwright test file (e.g., suites/plyson.spec.ts).
 */
export async function bootstrap(test: TestType<any, any>, expect: Expect) {
  const rootDir = process.env.plyson_ROOT || process.cwd()
  const env = process.env.plyson_ENV

  if (!env) {
    throw new Error(
      'plyson_ENV environment variable is not set. Please specify an environment with --env.',
    )
  }

  const loader = new ProjectLoader()
  const store = new VariableStore()

  try {
    // Load the project graph
    const graph = await loader.load(rootDir, env)

    // Check for persisted state
    const statePath = path.join(rootDir, STATE_DIR, STATE_FILE)
    let skipProjectHooks = false

    try {
      const stateContent = await fs.readFile(statePath, 'utf-8')
      const state = JSON.parse(stateContent)
      store.hydrate(state)
      skipProjectHooks = true
    } catch (e) {
      // No state found, will run project hooks
    }

    // Register all suites as Playwright tests
    registerSuites(graph, store, test, expect, { skipProjectHooks })
  } catch (error) {
    console.error('Failed to load plyson project:')
    throw error
  }
}

/**
 * Bootstraps the global setup project.
 * Runs project.json beforeAll and persists the VariableStore.
 */
export async function bootstrapSetup(test: TestType<any, any>, expect: Expect) {
  const rootDir = process.env.plyson_ROOT || process.cwd()
  const env = process.env.plyson_ENV

  if (!env) {
    throw new Error('plyson_ENV is required for bootstrapSetup')
  }

  const loader = new ProjectLoader()
  const store = new VariableStore()

  test('Global Setup', async ({ request }: { request: APIRequestContext }) => {
    const graph = await loader.load(rootDir, env)

    // Phase 1 resolution for global and environment variables
    store.push('global', {})
    resolvePhase1(graph.variables ?? {}, store, 'global')

    store.push('environment', {})
    resolvePhase1(graph.environment.variables ?? {}, store, 'environment')

    AssertionEngine.setExpect(expect)
    AssertionEngine.registerSchemas(graph.schemas)

    if (graph.project.beforeAll) {
      await runSteps(
        graph.project.beforeAll,
        request,
        store,
        graph,
        test,
        new ConsoleLogger('project-setup'),
      )
    }

    // Persist the state
    const stateDir = path.join(rootDir, STATE_DIR)
    await fs.mkdir(stateDir, { recursive: true })
    await fs.writeFile(path.join(stateDir, STATE_FILE), JSON.stringify(store.snapshot(), null, 2))
  })
}

/**
 * Bootstraps the global teardown project.
 * Runs project.json afterAll.
 */
export async function bootstrapTeardown(test: TestType<any, any>, expect: Expect) {
  const rootDir = process.env.plyson_ROOT || process.cwd()
  const env = process.env.plyson_ENV

  if (!env) {
    throw new Error('plyson_ENV is required for bootstrapTeardown')
  }

  const loader = new ProjectLoader()
  const store = new VariableStore()

  test('Global Teardown', async ({ request }: { request: APIRequestContext }) => {
    const graph = await loader.load(rootDir, env)

    // Load persisted state
    try {
      const statePath = path.join(rootDir, STATE_DIR, STATE_FILE)
      const stateContent = await fs.readFile(statePath, 'utf-8')
      store.hydrate(JSON.parse(stateContent))
    } catch (e) {
      // No state to load, hooks will run with fresh store
    }

    AssertionEngine.setExpect(expect)

    if (graph.project.afterAll) {
      await runSteps(
        graph.project.afterAll,
        request,
        store,
        graph,
        test,
        new ConsoleLogger('project-teardown'),
      )
    }

    // Clean up state file (optional, but good practice)
    try {
      await fs.unlink(path.join(rootDir, STATE_DIR, STATE_FILE))
    } catch (e) {
      // Ignore
    }
  })
}

// Re-export types for handlers/scripts
export type { HandlerContext } from './core/handler-runner.js'
export * from './types/index.js'

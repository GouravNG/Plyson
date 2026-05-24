import type { Expect, TestType } from '@playwright/test'
import { ProjectLoader } from './core/project-loader.js'
import { registerSuites } from './core/test-runner.js'
import { VariableStore } from './core/variable-store.js'

export { ProjectLoader } from './core/project-loader.js'
export type { ProjectGraph } from './core/project-loader.js'
export { registerSuites } from './core/test-runner.js'
export { VariableStore } from './core/variable-store.js'
export * from './errors/index.js'

/**
 * Bootstraps the playson project and registers all suites as Playwright tests.
 * This should be called from a Playwright test file (e.g., suites/playson.spec.ts).
 */
export async function bootstrap(test: TestType<any, any>, expect: Expect) {
  const rootDir = process.env.PLAYSON_ROOT || process.cwd()
  const env = process.env.PLAYSON_ENV

  if (!env) {
    throw new Error(
      'PLAYSON_ENV environment variable is not set. Please specify an environment with --env.',
    )
  }

  const loader = new ProjectLoader()
  const store = new VariableStore()

  try {
    // Load the project graph
    const graph = await loader.load(rootDir, env)

    // Register all suites as Playwright tests
    registerSuites(graph, store, test, expect)
  } catch (error) {
    console.error('Failed to load playson project:')
    throw error
  }
}

// Re-export types for handlers/scripts
export type { HandlerContext } from './core/handler-runner.js'
export * from './types/index.js'

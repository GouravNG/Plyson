import { ProjectLoader } from './core/project-loader.js'
import { registerSuites } from './core/test-runner.js'
import { VariableStore } from './core/variable-store.js'

/**
 * Bootstraps the play-son project and registers all suites as Playwright tests.
 * This should be called from a Playwright test file (e.g., suites/playson.spec.ts).
 */
export async function bootstrap(test: any, expect: any) {
  const rootDir = process.env.PLAYSON_ROOT || process.cwd()
  const env = process.env.PLAYSON_ENV

  if (!env) {
    throw new Error(
      'PLAYSON_ENV environment variable is not set. Please specify an environment with --env.'
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
    console.error('Failed to load play-son project:')
    throw error
  }
}

// Re-export types for handlers/scripts
export * from './types/index.js'
export type { HandlerContext } from './core/handler-runner.js'

import { ProjectLoader } from './project-loader.js';
import { registerSuites } from './test-runner.js';
import { VariableStore } from './variable-store.js';
import { registerBuiltins } from '../generators/registry.js';

// This file is intended to be loaded by Playwright.
// It uses environment variables set by the CLI to discover and register tests.

async function run() {
  const rootDir = process.env.PLAYSON_ROOT || process.cwd();
  const env = process.env.PLAYSON_ENV;

  if (!env) {
    throw new Error('PLAYSON_ENV environment variable is not set. Please specify an environment with --env.');
  }

  // Initialize global state
  registerBuiltins();

  const loader = new ProjectLoader();
  const store = new VariableStore();

  try {
    // Load the project graph
    const graph = await loader.load(rootDir, env);
    
    // Register all suites as Playwright tests
    registerSuites(graph, store);
  } catch (error) {
    console.error('Failed to load play-son project:');
    throw error;
  }
}

// Top-level await is supported in ESM Playwright tests
await run();

import type * as TestPackage from '@playson/test'
import { createRequire } from 'module'
import path from 'path'
import { pathToFileURL } from 'url'

/**
 * Dynamic loader for @playson/test package
 * Ensures CLI always uses the version installed in the consuming project
 * rather than relying on CLI's own dependency
 */

export type TestPackageType = typeof TestPackage

export async function loadTestPackage(): Promise<TestPackageType> {
  const projectRoot = process.env.PLAYSON_ROOT || process.cwd()

  try {
    // Create a require instance relative to the project root
    // We use a dummy filename in the root to ensure resolution starts there
    const require = createRequire(path.join(projectRoot, 'noop.js'))
    const testPackagePath = require.resolve('@playson/test')

    // Use pathToFileURL to ensure cross-platform compatibility with dynamic import()
    const testPackage = await import(pathToFileURL(testPackagePath).href)
    return testPackage as TestPackageType
  } catch (error) {
    const isModuleNotFound =
      error instanceof Error &&
      (error.message.includes('MODULE_NOT_FOUND') ||
        error.message.includes('Cannot find module') ||
        (error as any).code === 'ERR_MODULE_NOT_FOUND')

    const errorMessage = isModuleNotFound
      ? `@playson/test is not installed in this project.`
      : `Failed to load @playson/test: ${error instanceof Error ? error.message : String(error)}`

    console.error(`\n❌ Error: ${errorMessage}`)
    console.error(
      `\nTo fix this, install @playson/test in your project:\n  npm install @playson/test`,
    )
    console.error('Or if using pnpm:\n  pnpm install @playson/test\n')
    process.exit(1)
  }
}

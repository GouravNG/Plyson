import { glob } from 'glob'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  Project,
  TestSuite,
  Testcase,
  EnvironmentVariables,
  Variables,
  ProjectSchema,
  VariablesSchema,
  EnvironmentVariablesSchema,
  TestSuiteSchema,
  TestcaseSchema,
  HandlerModule,
  TestStep,
} from '../types/index.js'
import { LoadError, AggregateLoadError } from '../errors/index.js'

export interface ProjectGraph {
  project: Project
  variables: Variables
  environment: EnvironmentVariables
  schemas: Map<string, any>
  handlers: Map<string, HandlerModule>
  scripts: Map<string, Testcase>
  suites: TestSuite[]
}

export class ProjectLoader {
  async load(rootDir: string, env: string): Promise<ProjectGraph> {
    const errors: LoadError[] = []
    const absoluteRootDir = path.resolve(rootDir)

    // 1. Project
    let project: Project = {} as Project
    try {
      const content = await fs.readFile(path.join(absoluteRootDir, 'project.json'), 'utf-8')
      const parsed = JSON.parse(content)
      const result = ProjectSchema.safeParse(parsed)
      if (!result.success) {
        errors.push(new LoadError(`Invalid project.json: ${result.error.message}`, 'project.json'))
      } else {
        project = result.data
      }
    } catch (e: any) {
      errors.push(new LoadError(`Failed to read project.json: ${e.message}`, 'project.json'))
    }

    // 2. Variables
    let variables: Variables = {}
    try {
      const content = await fs.readFile(path.join(absoluteRootDir, 'variables.json'), 'utf-8')
      const parsed = JSON.parse(content)
      const result = VariablesSchema.safeParse(parsed)
      if (!result.success) {
        errors.push(
          new LoadError(`Invalid variables.json: ${result.error.message}`, 'variables.json')
        )
      } else {
        variables = result.data
      }
    } catch (e: any) {
      // Optional, so just default to {}
      variables = {}
    }

    // 3. Environment
    let environment: EnvironmentVariables = {} as EnvironmentVariables
    const envFile = path.join(absoluteRootDir, 'environments', `${env}.env.json`)
    try {
      const content = await fs.readFile(envFile, 'utf-8')
      const parsed = JSON.parse(content)
      const result = EnvironmentVariablesSchema.safeParse(parsed)
      if (!result.success) {
        errors.push(
          new LoadError(
            `Invalid environment file ${env}.env.json: ${result.error.message}`,
            `environments/${env}.env.json`
          )
        )
      } else {
        environment = result.data
      }
    } catch (e: any) {
      const loadErr = new LoadError(
        `Environment file not found or unreadable: ${envFile}`,
        `environments/${env}.env.json`
      )
      // According to algorithm, throw immediately if env is missing as we cannot continue
      if (errors.length > 0) {
        throw new AggregateLoadError([...errors, loadErr])
      }
      throw loadErr
    }

    // 4. Schemas
    const schemas = new Map<string, any>()
    const schemaFiles = await glob('schemas/*.schema.json', { cwd: absoluteRootDir })
    for (const file of schemaFiles) {
      try {
        const content = await fs.readFile(path.join(absoluteRootDir, file), 'utf-8')
        const stem = path.basename(file, '.schema.json')
        schemas.set(stem, JSON.parse(content))
      } catch (e: any) {
        errors.push(new LoadError(`Failed to parse schema ${file}: ${e.message}`, file))
      }
    }

    // 5. Handlers
    const handlers = new Map<string, HandlerModule>()
    const handlerFiles = await glob('handlers/*.handler.ts', { cwd: absoluteRootDir })
    for (const file of handlerFiles) {
      const absoluteHandlerPath = path.join(absoluteRootDir, file)
      try {
        // Use pathToFileURL for Windows compatibility with dynamic import
        const fileUrl = new URL(`file://${absoluteHandlerPath.replace(/\\/g, '/')}`).href
        const mod = await import(fileUrl)
        const stem = path.basename(file, '.handler.ts')
        if (typeof mod.run !== 'function') {
          errors.push(new LoadError(`Handler "${stem}" missing run export`, file))
        } else {
          handlers.set(stem, mod)
        }
      } catch (e: any) {
        errors.push(new LoadError(`Failed to load handler ${file}: ${e.message}`, file))
      }
    }

    // 6. Scripts
    const scripts = new Map<string, Testcase>()
    const scriptFiles = await glob('scripts/*.script.json', { cwd: absoluteRootDir })
    for (const file of scriptFiles) {
      try {
        const content = await fs.readFile(path.join(absoluteRootDir, file), 'utf-8')
        const parsed = JSON.parse(content)
        const result = TestcaseSchema.safeParse(parsed)
        if (!result.success) {
          errors.push(new LoadError(`Invalid script ${file}: ${result.error.message}`, file))
        } else {
          const tc = result.data
          if (scripts.has(tc.id)) {
            errors.push(new LoadError(`Duplicate script id: ${tc.id}`, file))
          } else {
            scripts.set(tc.id, tc)
          }
        }
      } catch (e: any) {
        errors.push(new LoadError(`Failed to parse script ${file}: ${e.message}`, file))
      }
    }

    // 7. Suites
    const suites: TestSuite[] = []
    const suiteIds = new Set<string>()
    const suiteFiles = await glob('suites/**/*.test.json', { cwd: absoluteRootDir })
    for (const file of suiteFiles) {
      try {
        const content = await fs.readFile(path.join(absoluteRootDir, file), 'utf-8')
        const parsed = JSON.parse(content)
        const result = TestSuiteSchema.safeParse(parsed)
        if (!result.success) {
          errors.push(new LoadError(`Invalid suite ${file}: ${result.error.message}`, file))
        } else {
          const suite = result.data
          for (const tc of suite.testCases) {
            if (scripts.has(tc.id) || suiteIds.has(tc.id)) {
              errors.push(
                new LoadError(
                  `Collision: Testcase ID "${tc.id}" already exists in scripts or another suite`,
                  file
                )
              )
            } else {
              suiteIds.add(tc.id)
            }
          }
          suites.push(suite)
        }
      } catch (e: any) {
        errors.push(new LoadError(`Failed to parse suite ${file}: ${e.message}`, file))
      }
    }

    // 8. Resolve refs
    const resolveRefsInSteps = (steps: TestStep[], sourceFile: string) => {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        if ('ref' in step && step.ref) {
          const target = scripts.get(step.ref)
          if (!target) {
            errors.push(new LoadError(`Ref "${step.ref}" not found`, sourceFile))
            continue
          }
          // Replace step with target steps (flattening)
          // The algorithm says "replace step with deep clone of the script's steps"
          // This implies a single step with 'ref' can expand into multiple steps from the script.
          // Let's re-read the technical details.
          // "replace step in-place with deep clone of script's steps"
          // This usually means splicing.
          const clonedSteps = JSON.parse(JSON.stringify(target.steps))
          steps.splice(i, 1, ...clonedSteps)
          i += clonedSteps.length - 1 // Skip the newly added steps
        }
      }
    }

    for (const suite of suites) {
      if (suite.beforeAll) resolveRefsInSteps(suite.beforeAll, 'suite beforeAll')
      if (suite.afterAll) resolveRefsInSteps(suite.afterAll, 'suite afterAll')
      for (const tc of suite.testCases) {
        resolveRefsInSteps(tc.steps, `testcase ${tc.id}`)
      }
    }
    // Also resolve refs in scripts themselves (they can ref other scripts)
    for (const [id, tc] of scripts) {
      resolveRefsInSteps(tc.steps, `script ${id}`)
    }

    if (errors.length > 0) {
      throw new AggregateLoadError(errors)
    }

    return {
      project,
      variables,
      environment,
      schemas,
      handlers,
      scripts,
      suites,
    }
  }
}

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
import { LoadError } from '../errors/index.js'
import { ConsoleLogger, Logger } from './logger.js'

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
  private logger: Logger

  constructor(logger?: Logger) {
    this.logger = logger || new ConsoleLogger('project-loader')
  }

  async load(rootDir: string, env: string): Promise<ProjectGraph> {
    const absoluteRootDir = path.resolve(rootDir)

    // 1. Project
    let project: Project = {} as Project
    try {
      const content = await fs.readFile(path.join(absoluteRootDir, 'project.json'), 'utf-8')
      const parsed = JSON.parse(content)
      const result = ProjectSchema.safeParse(parsed)
      if (!result.success) {
        throw new LoadError(`Invalid project.json: ${result.error.message}`, 'project.json')
      }
      project = result.data
      this.logger.info(`✓ Project loaded: ${project.title}`)
    } catch (e: any) {
      if (e instanceof LoadError) throw e
      throw new LoadError(`Failed to read project.json: ${e.message}`, 'project.json')
    }

    // 2. Variables
    let variables: Variables = {}
    try {
      const content = await fs.readFile(path.join(absoluteRootDir, 'variables.json'), 'utf-8')
      const parsed = JSON.parse(content)
      const result = VariablesSchema.safeParse(parsed)
      if (!result.success) {
        this.logger.warn('variables.json', `Invalid variables.json: ${result.error.message}`)
      } else {
        variables = result.data
        this.logger.info(`✓ Variables loaded: ${Object.keys(variables).length} variable(s)`)
      }
    } catch (e: any) {
      // Optional, so just default to {}
      variables = {}
      this.logger.info('✓ Variables: using defaults (no variables.json found)')
    }

    // 3. Environment
    let environment: EnvironmentVariables = {} as EnvironmentVariables
    const envFile = path.join(absoluteRootDir, 'environments', `${env}.env.json`)
    try {
      const content = await fs.readFile(envFile, 'utf-8')
      const parsed = JSON.parse(content)
      const result = EnvironmentVariablesSchema.safeParse(parsed)
      if (!result.success) {
        throw new LoadError(
          `Invalid environment file ${env}.env.json: ${result.error.message}`,
          `environments/${env}.env.json`
        )
      }
      environment = result.data
      this.logger.info(
        `✓ Environment loaded: "${env}" with ${Object.keys(environment).length} variable(s)`
      )
    } catch (e: any) {
      if (e instanceof LoadError) throw e
      throw new LoadError(
        `Environment file not found or unreadable: ${envFile}`,
        `environments/${env}.env.json`
      )
    }

    // 4. Schemas
    const schemas = new Map<string, any>()
    const schemaFiles = await glob('schemas/**/*.schema.json', { cwd: absoluteRootDir })
    for (const file of schemaFiles) {
      try {
        const content = await fs.readFile(path.join(absoluteRootDir, file), 'utf-8')
        const stem = path.basename(file, '.schema.json')
        schemas.set(stem, JSON.parse(content))
      } catch (e: any) {
        this.logger.warn(file, `Failed to parse schema: ${e.message}`)
      }
    }
    this.logger.info(`✓ Schemas loaded: ${schemas.size} schema(s)`)

    // 5. Handlers
    const handlers = new Map<string, HandlerModule>()
    const handlerFiles = await glob('handlers/**/*.handler.ts', { cwd: absoluteRootDir })
    for (const file of handlerFiles) {
      const absoluteHandlerPath = path.join(absoluteRootDir, file)
      try {
        // Use pathToFileURL for Windows compatibility with dynamic import
        const fileUrl = new URL(`file://${absoluteHandlerPath.replace(/\\/g, '/')}`).href
        const mod = await import(fileUrl)
        const stem = path.basename(file, '.handler.ts')
        if (typeof mod.run !== 'function') {
          this.logger.warn(file, `Handler "${stem}" missing run export`)
        } else {
          handlers.set(stem, mod)
        }
      } catch (e: any) {
        this.logger.warn(file, `Failed to load handler: ${e.message}`)
      }
    }
    this.logger.info(`✓ Handlers loaded: ${handlers.size} handler(s)`)

    // 6. Scripts
    const scripts = new Map<string, Testcase>()
    const scriptFiles = await glob('scripts/**/*.script.json', { cwd: absoluteRootDir })
    for (const file of scriptFiles) {
      try {
        const content = await fs.readFile(path.join(absoluteRootDir, file), 'utf-8')
        const parsed = JSON.parse(content)
        const result = TestcaseSchema.safeParse(parsed)
        if (!result.success) {
          this.logger.warn(file, `Invalid script: ${result.error.message}`)
        } else {
          const tc = result.data
          if (scripts.has(tc.id)) {
            this.logger.warn(file, `Duplicate script id: ${tc.id}`)
          } else {
            scripts.set(tc.id, tc)
          }
        }
      } catch (e: any) {
        this.logger.warn(file, `Failed to parse script: ${e.message}`)
      }
    }
    this.logger.info(`✓ Scripts loaded: ${scripts.size} script(s)`)

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
          this.logger.warn(file, `Invalid suite: ${result.error.message}`)
        } else {
          const suite = result.data
          let hasCollision = false
          for (const tc of suite.testCases) {
            if (scripts.has(tc.id) || suiteIds.has(tc.id)) {
              this.logger.warn(
                file,
                `Collision: Testcase ID "${tc.id}" already exists in scripts or another suite`
              )
              hasCollision = true
              break
            }
          }

          if (!hasCollision) {
            for (const tc of suite.testCases) {
              suiteIds.add(tc.id)
            }
            suites.push(suite)
          }
        }
      } catch (e: any) {
        this.logger.warn(file, `Failed to parse suite: ${e.message}`)
      }
    }
    this.logger.info(`✓ Suites loaded: ${suites.length} suite(s) with ${suiteIds.size} testcase(s)`)

    // 8. Resolve refs
    const resolveRefsInSteps = (steps: TestStep[], sourceFile: string) => {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        if ('ref' in step && step.ref) {
          const target = scripts.get(step.ref)
          if (!target) {
            this.logger.warn(sourceFile, `Ref "${step.ref}" not found`)
            continue
          }
          const clonedSteps = JSON.parse(JSON.stringify(target.steps))
          steps.splice(i, 1, ...clonedSteps)
          i += clonedSteps.length - 1
        }
      }
    }

    for (const suite of suites) {
      if (suite.beforeAll) resolveRefsInSteps(suite.beforeAll, `suite ${suite.title} beforeAll`)
      if (suite.afterAll) resolveRefsInSteps(suite.afterAll, `suite ${suite.title} afterAll`)
      for (const tc of suite.testCases) {
        resolveRefsInSteps(tc.steps, `testcase ${tc.id}`)
      }
    }

    if (project.beforeAll) resolveRefsInSteps(project.beforeAll, 'project beforeAll')
    if (project.afterAll) resolveRefsInSteps(project.afterAll, 'project afterAll')

    for (const [id, tc] of scripts) {
      resolveRefsInSteps(tc.steps, `script ${id}`)
    }

    this.logger.info('✓ References resolved in all test steps')

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

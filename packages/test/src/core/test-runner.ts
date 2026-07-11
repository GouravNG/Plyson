import type { APIRequestContext, Expect, TestType } from '@playwright/test'
import { ResolvedStep, SoftError, TestStep } from '../types/index.js'
import { safeParseJson } from '../utils/safe-parse-json.js'
import { sleep } from '../utils/sleep.js'
import { ActionRunner } from './action-runner.js'
import { AssertionEngine } from './assertion-engine.js'
import { ExtractionEngine } from './extraction-engine.js'
import { HandlerContext, HandlerRunner } from './handler-runner.js'
import { HttpExecutor, ResolvedRequest } from './http-executor.js'
import { ConsoleLogger, Logger } from './logger.js'
import { ProjectGraph } from './project-loader.js'
import { Resolver, resolvePhase1, resolvePhase2 } from './resolver.js'
import { VariableStore } from './variable-store.js'

import { formatError } from '../utils/error-formatter.js'

/**
 * Options for suite registration.
 */
export interface RegisterOptions {
  /**
   * If true, the project-level beforeAll and afterAll hooks from project.json will be skipped.
   * Useful when these hooks are handled by a Playwright Setup Project.
   */
  skipProjectHooks?: boolean
}

/**
 * Registers all suites from the project graph as Playwright tests.
 */
export function registerSuites(
  graph: ProjectGraph,
  store: VariableStore,
  test: TestType<any, any>,
  expect: Expect,
  options: RegisterOptions = {},
): void {
  if (!test || !expect) {
    throw new Error('registerSuites requires the active Playwright test and expect instances.')
  }

  AssertionEngine.setExpect(expect)

  const mode = graph.project.mode === 'sequential' ? 'default' : 'parallel'
  test.describe.configure({ mode })

  test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
    if (!options.skipProjectHooks) {
      store.push('global', {})
      store.push('environment', {})
      resolvePhase1(graph.variables ?? {}, store, 'global')
      resolvePhase1(graph.environment.variables ?? {}, store, 'environment')
    }

    AssertionEngine.registerSchemas(graph.schemas)

    if (!options.skipProjectHooks && graph.project.beforeAll) {
      await runSteps(
        graph.project.beforeAll,
        request,
        store,
        graph,
        test,
        new ConsoleLogger('project-beforeAll'),
      )
    }
  })

  test.afterAll(async ({ request }: { request: APIRequestContext }) => {
    if (!options.skipProjectHooks && graph.project.afterAll) {
      await runSteps(
        graph.project.afterAll,
        request,
        store,
        graph,
        test,
        new ConsoleLogger('project-afterAll'),
      )
    }
  })

  for (const suite of graph.suites) {
    let describeFn = suite.disabled ? test.describe.skip : test.describe

    // If suite contains skip or fixme in annotations, mark it accordingly
    if (suite.annotations) {
      const suiteAnnList = Array.isArray(suite.annotations)
        ? suite.annotations
        : [suite.annotations]
      for (const ann of suiteAnnList) {
        const type = typeof ann === 'string' ? ann : ann.type
        if (type === 'skip') {
          describeFn = test.describe.skip
        } else if (type === 'fixme') {
          describeFn = test.describe.fixme
        }
      }
    }

    describeFn(suite.title, () => {
      const suiteMode = suite.mode === 'sequential' ? 'default' : 'parallel'
      test.describe.configure({ mode: suiteMode })

      test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
        store.push('suite', {})
        resolvePhase1(suite.variables ?? {}, store, 'suite')
        if (suite.beforeAll) {
          await runSteps(
            suite.beforeAll,
            request,
            store,
            graph,
            test,
            new ConsoleLogger(`${suite.title}-beforeAll`),
          )
        }
      })

      test.afterAll(async ({ request }: { request: APIRequestContext }) => {
        if (suite.afterAll) {
          await runSteps(
            suite.afterAll,
            request,
            store,
            graph,
            test,
            new ConsoleLogger(`${suite.title}-afterAll`),
          )
        }
        store.pop('suite')
      })

      for (const testCase of suite.testCases) {
        const testFn = testCase.disabled ? test.skip : test
        const allTags = [...new Set([...suite.tags, ...testCase.tags])]
        if (testCase.testType) {
          allTags.push(testCase.testType)
        }
        const formattedTags = allTags.map((t: string) => (t.startsWith('@') ? t : `@${t}`))

        testFn(
          `[${testCase.id}] ${testCase.title}`,
          { tag: formattedTags },
          async ({ request }: { request: APIRequestContext }, testInfo) => {
            // Push TestCase id and type annotations first
            testInfo.annotations.push({ type: 'id', description: testCase.id })
            if (testCase.testType) {
              testInfo.annotations.push({ type: 'testType', description: testCase.testType })
            }

            // Propagate suite-level custom annotations into the testInfo of each test case
            if (suite.annotations) {
              const suiteAnnList = Array.isArray(suite.annotations)
                ? suite.annotations
                : [suite.annotations]
              for (const ann of suiteAnnList) {
                const type = typeof ann === 'string' ? ann : ann.type
                const desc = typeof ann === 'string' ? undefined : ann.description
                if (type !== 'skip' && type !== 'fixme') {
                  testInfo.annotations.push({ type, description: desc })
                }
              }
            }

            // Apply testcase-level annotations
            if (testCase.annotations) {
              const caseAnnList = Array.isArray(testCase.annotations)
                ? testCase.annotations
                : [testCase.annotations]
              for (const ann of caseAnnList) {
                const type = typeof ann === 'string' ? ann : ann.type
                const desc = typeof ann === 'string' ? undefined : ann.description

                if (type === 'skip') {
                  // test.skip() internally pushes {type:'skip', description} to testInfo.annotations
                  test.skip(true, desc)
                } else if (type === 'fail') {
                  // test.fail() internally pushes {type:'fail', description} to testInfo.annotations
                  test.fail(true, desc)
                } else if (type === 'fixme') {
                  // test.fixme() internally pushes {type:'fixme', description} to testInfo.annotations
                  test.fixme(true, desc)
                } else if (type === 'slow') {
                  // test.slow() internally pushes {type:'slow', description} to testInfo.annotations
                  test.slow(true, desc)
                } else {
                  // Custom annotation type — push manually since Playwright won't handle it
                  testInfo.annotations.push({ type, description: desc ?? '' })
                }
              }
            }

            const logger = new ConsoleLogger(testCase.id)
            logger.info(`Running testcase: ${testCase.title}`)

            // Phase 1 — resolve case variables once before any step runs
            store.push('case', {})
            resolvePhase1(testCase.variables ?? {}, store, 'case')

            try {
              await runSteps(testCase.steps, request, store, graph, test, logger, testInfo)
            } catch (error) {
              logger.error(error)
              throw error
            } finally {
              store.pop('case')
            }
          },
        )
      }
    })
  }
}

/**
 * Executes a list of test steps.
 */
export async function runSteps(
  steps: TestStep[],
  request: APIRequestContext,
  store: VariableStore,
  graph: ProjectGraph,
  test: TestType<any, any>,
  logger: Logger,
  testInfo?: any,
): Promise<void> {
  const executor = new HttpExecutor(request, graph.environment.baseUrl, graph.schemas)

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    // Skip if it's a referenced step that wasn't resolved (shouldn't happen with ProjectLoader)
    if ('ref' in step) continue
    if (step.disabled) continue

    await test.step(step.title, async () => {
      if (step.wait) await sleep(step.wait)

      if ('action' in step) {
        const actionRunner = new ActionRunner(request, store, graph.actions, logger)
        await actionRunner.runAction(step)
        return
      }

      logger.info(`Executing step ${i + 1}: ${step.title}`)

      // Phase 2 resolution — fresh per step
      const resolvedRequest = resolvePhase2(step.request, store, step.title)

      const response = await executor.execute({
        ...step,
        request: resolvedRequest as ResolvedRequest,
      } as ResolvedStep)

      const body = await safeParseJson(response)
      const softErrors: SoftError[] = []

      // 1. Status code check
      AssertionEngine.checkStatusCode(
        response.status(),
        step.response.validations.statusCode,
        logger,
      )

      // 2. Schema validation
      if (step.response.schema) {
        await AssertionEngine.validateSchema(
          body,
          step.response.schema,
          graph.schemas,
          softErrors,
          logger,
        )
      }

      // 3. Inline assertions
      for (const assertion of step.response.validations.assertions ?? []) {
        const resolver = new Resolver(store, step.title)
        const resolvedAssertion = {
          ...assertion,
          value: assertion.value !== undefined ? resolver.resolve(assertion.value) : undefined,
        }
        await AssertionEngine.runAssertion(resolvedAssertion, body, response, softErrors, logger)
      }

      // 4. Extraction Engine
      for (const extraction of step.response.extract ?? []) {
        ExtractionEngine.runExtraction(extraction, body, response, store, logger)
      }

      // 5. Handler Runner
      if (step.handlers && step.handlers.length > 0) {
        const ctx: HandlerContext = {
          request: resolvedRequest as ResolvedRequest,
          response,
          body,
          status: response.status(),
          store: {
            get: (name: string) => store.get(name),
            set: (name: string, value: any, scope: any) => store.set(name, value, scope),
          },
          log: (message: string) => logger.info(`[Handler] ${message}`),
          warn: (title: string, message: any) => {
            logger.warn(title, message)
            softErrors.push({ title, error: message })
          },
          error: (message: any) => {
            logger.error(message)
            throw message instanceof Error ? message : new Error(String(message))
          },
        }
        await HandlerRunner.runHandlers(step.handlers, ctx, graph.handlers)
      }

      // Record soft errors as Playwright annotations
      if (testInfo) {
        for (const soft of softErrors) {
          const description = formatError(soft.error, true)

          logger.warn(soft.title, soft.error)

          testInfo.annotations.push({
            type: 'warn',
            description: `${soft.title}: ${description}`,
          })
        }
      }
    })
  }
}

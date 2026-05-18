import type { APIRequestContext } from '@playwright/test'
import { ProjectGraph } from './project-loader.js'
import { VariableStore } from './variable-store.js'
import { HttpExecutor, ResolvedRequest } from './http-executor.js'
import { Resolver, resolvePhase1, resolvePhase2 } from './resolver.js'
import { AssertionEngine } from './assertion-engine.js'
import { ExtractionEngine } from './extraction-engine.js'
import { HandlerRunner, HandlerContext } from './handler-runner.js'
import { TestStep, SoftError, ResolvedStep } from '../types/index.js'
import { sleep } from '../utils/sleep.js'
import { safeParseJson } from '../utils/safe-parse-json.js'
import { ConsoleLogger, Logger } from './logger.js'

/**
 * Registers all suites from the project graph as Playwright tests.
 */
export function registerSuites(
  graph: ProjectGraph,
  store: VariableStore,
  test: any,
  expect: any
): void {
  if (!test || !expect) {
    throw new Error('registerSuites requires the active Playwright test and expect instances.')
  }

  AssertionEngine.setExpect(expect)

  test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
    store.push('global', graph.variables)
    store.push('environment', graph.environment.variables ?? {})
    if (graph.project.beforeAll) {
      await runSteps(graph.project.beforeAll, request, store, graph, test, new ConsoleLogger('project-beforeAll'))
    }
  })

  test.afterAll(async ({ request }: { request: APIRequestContext }) => {
    if (graph.project.afterAll) {
      await runSteps(graph.project.afterAll, request, store, graph, test, new ConsoleLogger('project-afterAll'))
    }
  })

  for (const suite of graph.suites) {
    const describeFn = suite.disabled ? test.describe.skip : test.describe

    describeFn(suite.title, () => {
      test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
        store.push('suite', suite.variables ?? {})
        if (suite.beforeAll) {
          await runSteps(suite.beforeAll, request, store, graph, test, new ConsoleLogger(`${suite.title}-beforeAll`))
        }
      })

      test.afterAll(async ({ request }: { request: APIRequestContext }) => {
        if (suite.afterAll) {
          await runSteps(suite.afterAll, request, store, graph, test, new ConsoleLogger(`${suite.title}-afterAll`))
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
          testCase.title,
          { tag: formattedTags },
          async ({ request }: { request: APIRequestContext }) => {
            if (testCase.testType) {
              test.info().annotations.push({ type: 'testType', description: testCase.testType })
            }

            const logger = new ConsoleLogger(testCase.id)
            logger.info(`Running testcase: ${testCase.title}`)

            // Phase 1 — resolve case variables once before any step runs
            const resolvedVars = resolvePhase1(testCase.variables ?? {}, store)
            store.push('case', resolvedVars)

            try {
              await runSteps(testCase.steps, request, store, graph, test, logger)
            } catch (error) {
              logger.error(error)
              throw error
            } finally {
              store.pop('case')
            }
          }
        )
      }
    })
  }
}

/**
 * Executes a list of test steps.
 */
async function runSteps(
  steps: TestStep[],
  request: APIRequestContext,
  store: VariableStore,
  graph: ProjectGraph,
  test: any,
  logger: Logger
): Promise<void> {
  const executor = new HttpExecutor(request, graph.environment.baseUrl, graph.schemas)

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    // Skip if it's a referenced step that wasn't resolved (shouldn't happen with ProjectLoader)
    if ('ref' in step) continue
    if (step.disabled) continue

    await test.step(step.title, async () => {
      if (step.wait) await sleep(step.wait)

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
      AssertionEngine.checkStatusCode(response.status(), step.response.validations.statusCode)

      // 2. Schema validation
      if (step.response.schema) {
        await AssertionEngine.validateSchema(body, step.response.schema, graph.schemas, softErrors)
      }

      // 3. Inline assertions
      for (const assertion of step.response.validations.assertions ?? []) {
        const resolver = new Resolver(store, step.title)
        const resolvedAssertion = {
          ...assertion,
          value: assertion.value !== undefined ? resolver.resolve(assertion.value) : undefined,
        }
        await AssertionEngine.runAssertion(resolvedAssertion, body, response, softErrors)
      }

      // 4. Extraction Engine
      for (const extraction of step.response.extract ?? []) {
        ExtractionEngine.runExtraction(extraction, body, response, store)
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
      for (const soft of softErrors) {
        let description = ''
        if (soft.error instanceof Error) {
          description = soft.error.message
        } else if (Array.isArray(soft.error)) {
          // likely AJV errors
          description = JSON.stringify(soft.error, null, 2)
        } else {
          description = String(soft.error)
        }

        logger.warn(soft.title, soft.error)

        test.info().annotations.push({
          type: 'warn',
          description: `${soft.title}: ${description}`,
        })
      }
    })
  }
}

import * as fs from 'fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { ProjectLoader } from '../../core/project-loader.js'
import { registerSuites } from '../../core/test-runner.js'
import { VariableStore } from '../../core/variable-store.js'

vi.mock('fs/promises')
vi.mock('glob', () => ({
  glob: vi.fn(),
}))

describe('Bug Regressions (Issue #7, #5, #6)', () => {
  describe('Issue #7: Ref style testcase not working at Global scope', () => {
    it('should resolve refs in project beforeAll/afterAll', async () => {
      const mockedFs = fs as any
      const mockedGlob = await import('glob')

      mockedFs.readFile.mockImplementation((p: string) => {
        if (p.endsWith('project.json'))
          return JSON.stringify({
            title: 'Test',
            version: '1.0.0',
            beforeAll: [{ ref: 'setup-db' }],
          })
        if (p.endsWith('variables.json')) return JSON.stringify({})
        if (p.endsWith('dev.env.json')) return JSON.stringify({ baseUrl: 'http://localhost' })
        if (p.endsWith('setup-db.script.json'))
          return JSON.stringify({
            id: 'setup-db',
            title: 'Setup DB',
            tags: [],
            steps: [
              {
                title: 'Init',
                request: { method: 'GET', endpoint: '/init' },
                response: { validations: { statusCode: 200 } },
              },
            ],
          })
        return '[]'
      })

      vi.mocked(mockedGlob.glob).mockImplementation(async (pattern) => {
        if (pattern === 'schemas/**/*.schema.json') return []
        if (pattern === 'handlers/**/*.handler.ts') return []
        if (pattern === 'scripts/**/*.script.json') return ['scripts/setup-db.script.json']
        if (pattern === 'suites/**/*.test.json') return []
        return []
      })

      const loader = new ProjectLoader()
      const graph = await loader.load('.', 'dev')

      expect(graph.project.beforeAll?.[0]).not.toHaveProperty('ref')
      expect(graph.project.beforeAll?.[0].title).toBe('Init')
    })
  })

  describe('Issue #5 & #6: Tag inheritance and testType', () => {
    it('should merge suite tags and include testType as a tag', () => {
      const playwrightTest = vi.fn() as any
      playwrightTest.describe = vi.fn((title, cb) => cb())
      playwrightTest.describe.skip = vi.fn()
      playwrightTest.describe.configure = vi.fn()
      playwrightTest.beforeAll = vi.fn()
      playwrightTest.afterAll = vi.fn()

      const graph: any = {
        project: { beforeAll: [], afterAll: [] },
        variables: {},
        environment: { variables: {} },
        suites: [
          {
            title: 'Suite 1',
            tags: ['smoke'],
            testCases: [
              {
                id: 'tc1',
                title: 'Test 1',
                testType: 'positive',
                tags: ['critical'],
                steps: [],
              },
            ],
          },
        ],
      }
      const store = new VariableStore()

      registerSuites(graph, store, playwrightTest, expect)

      expect(playwrightTest).toHaveBeenCalledWith(
        '[tc1] Test 1',
        expect.objectContaining({
          tag: expect.arrayContaining(['@smoke', '@critical', '@positive']),
        }),
        expect.any(Function),
      )
    })
  })

  describe('Suite-Level Execution Mode', () => {
    it('should apply mode: "default" for sequential suites and mode: "parallel" for parallel suites', () => {
      const playwrightTest = vi.fn() as any
      playwrightTest.describe = vi.fn((title, cb) => cb())
      playwrightTest.describe.skip = vi.fn()
      playwrightTest.describe.configure = vi.fn()
      playwrightTest.beforeAll = vi.fn()
      playwrightTest.afterAll = vi.fn()

      const graph: any = {
        project: { mode: 'parallel', beforeAll: [], afterAll: [] },
        variables: {},
        environment: { variables: {} },
        suites: [
          {
            title: 'Sequential Suite',
            mode: 'sequential',
            tags: [],
            testCases: [{ id: 'tc1', title: 'T1', tags: [], steps: [] }],
          },
          {
            title: 'Parallel Suite',
            mode: 'parallel',
            tags: [],
            testCases: [{ id: 'tc2', title: 'T2', tags: [], steps: [] }],
          },
        ],
      }
      const store = new VariableStore()

      registerSuites(graph, store, playwrightTest, expect)

      // First call is for the project-level mode
      expect(playwrightTest.describe.configure).toHaveBeenNthCalledWith(1, { mode: 'parallel' })

      // Second call is for the first suite (sequential -> default)
      expect(playwrightTest.describe.configure).toHaveBeenNthCalledWith(2, { mode: 'default' })

      // Third call is for the second suite (parallel -> parallel)
      expect(playwrightTest.describe.configure).toHaveBeenNthCalledWith(3, { mode: 'parallel' })
    })
  })

  describe('Playwright Annotations Support', () => {
    it('should apply suite and testcase annotations correctly', () => {
      const playwrightTest = vi.fn((title, options, cb) => {
        const testInfo = { annotations: [] as any[] }
        const callback = typeof options === 'function' ? options : cb
        callback({ request: {} }, testInfo)
      }) as any
      playwrightTest.describe = vi.fn((title, cb) => cb())
      playwrightTest.describe.skip = vi.fn((title, cb) => {
        if (cb) cb()
      })
      playwrightTest.describe.fixme = vi.fn()
      playwrightTest.describe.configure = vi.fn()
      playwrightTest.beforeAll = vi.fn()
      playwrightTest.afterAll = vi.fn()
      playwrightTest.skip = vi.fn()
      playwrightTest.fail = vi.fn()
      playwrightTest.fixme = vi.fn()
      playwrightTest.slow = vi.fn()

      const graph: any = {
        project: { beforeAll: [], afterAll: [] },
        variables: {},
        environment: { variables: {} },
        suites: [
          {
            title: 'Suite 1',
            tags: [],
            annotations: ['skip', { type: 'custom-suite', description: 'suite-info' }],
            testCases: [
              {
                id: 'tc1',
                title: 'Test 1',
                tags: [],
                annotations: [
                  'slow',
                  { type: 'issue', description: 'https://issue-link' }
                ],
                steps: [],
              },
            ],
          },
        ],
      }
      const store = new VariableStore()

      registerSuites(graph, store, playwrightTest, expect)

      expect(playwrightTest.describe.skip).toHaveBeenCalled()
      expect(playwrightTest.slow).toHaveBeenCalledWith(true, undefined)
    })
  })
})

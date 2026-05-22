import { describe, expect, it, vi } from 'vitest'
import { ProjectLoader } from '../core/project-loader.js'
import * as fs from 'fs/promises'
import { registerSuites } from '../core/test-runner.js'
import { VariableStore } from '../core/variable-store.js'

describe('Bug Regressions (Issue #7, #5, #6)', () => {
  describe('Issue #7: Ref style testcase not working at Global scope', () => {
    it('should resolve refs in project beforeAll/afterAll', async () => {
      vi.mock('fs/promises')
      const mockedFs = fs as any

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

      vi.mock('glob', () => ({
        glob: vi.fn().mockImplementation(async (pattern) => {
          if (pattern === 'schemas/**/*.schema.json') return []
          if (pattern === 'handlers/**/*.handler.ts') return []
          if (pattern === 'scripts/**/*.script.json') return ['scripts/setup-db.script.json']
          if (pattern === 'suites/**/*.test.json') return []
          return []
        }),
      }))

      const loader = new ProjectLoader()
      const graph = await loader.load('.', 'dev')

      expect(graph.project.beforeAll?.[0]).not.toHaveProperty('ref')
      expect(graph.project.beforeAll?.[0].title).toBe('Init')

      vi.restoreAllMocks()
    })
  })

  describe('Issue #5 & #6: Tag inheritance and testType', () => {
    it('should merge suite tags and include testType as a tag', () => {
      const playwrightTest = vi.fn() as any
      playwrightTest.describe = vi.fn((title, cb) => cb())
      playwrightTest.describe.skip = vi.fn()
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
        expect.any(Function)
      )
    })
  })
})

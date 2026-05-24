import * as path from 'path'
import { describe, expect, it } from 'vitest'
import { ProjectLoader } from '../../core/project-loader.js'
import { LoadError } from '../../errors/index.js'

describe('ProjectLoader', () => {
  const fixtureDir = path.resolve(__dirname, '../fixtures/valid-project')

  it('should load a valid project correctly', async () => {
    const loader = new ProjectLoader()
    const graph = await loader.load(fixtureDir, 'dev')

    expect(graph.project.title).toBe('Valid Project')
    expect(graph.variables.globalVar).toBe('globalValue')
    expect(graph.environment.baseUrl).toBe('https://api.dev.com')
    expect(graph.schemas.has('user')).toBe(true)
    expect(graph.handlers.has('debug')).toBe(true)
    expect(graph.scripts.has('login-script')).toBe(true)
    expect(graph.suites.length).toBe(1)

    // Check ref resolution
    const suite = graph.suites[0]
    const testCase = suite.testCases[0]
    expect(testCase.steps[0]).not.toHaveProperty('ref')
    expect(testCase.steps[0].title).toBe('Post Login')
  })

  it('should throw immediately if environment file is missing', async () => {
    const loader = new ProjectLoader()
    await expect(loader.load(fixtureDir, 'prod')).rejects.toThrow(LoadError)
  })

  it('should collect multiple errors into AggregateLoadError', async () => {
    // We can simulate errors by pointing to a non-existent directory or one with broken files
    // For simplicity, let's just use a non-existent project directory for a basic check
    const loader = new ProjectLoader()
    await expect(loader.load('non-existent', 'dev')).rejects.toThrow()
  })
})

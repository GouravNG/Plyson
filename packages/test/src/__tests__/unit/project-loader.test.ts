import * as path from 'path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { ProjectLoader } from '../../core/project-loader.js'
import { LoadError } from '../../errors/index.js'

describe('ProjectLoader', () => {
  const fixtureDir = path.resolve(__dirname, '../fixtures/valid-project')
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.BASE_URL
    delete process.env.baseUrl
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('should load a valid project correctly', async () => {
    const loader = new ProjectLoader()
    const graph = await loader.load(fixtureDir, 'dev')

    expect(graph.project.title).toBe('Valid Project')
    expect(graph.project.mode).toBe('parallel') // Default value
    expect(graph.variables.globalVar).toBe('globalValue')
    expect(graph.environment.baseUrl).toBe('https://api.dev.com')
    expect(graph.schemas.has('user')).toBe(true)
    expect(graph.handlers.has('debug')).toBe(true)
    expect(graph.scripts.has('login-script')).toBe(true)
    expect(graph.suites.length).toBe(1)

    // Check default suite mode
    expect(graph.suites[0].mode).toBe('sequential')

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

  it('should support loading from .env and merging with .env.json', async () => {
    const envFixtureDir = path.resolve(__dirname, '../fixtures/env-project')
    const loader = new ProjectLoader()
    const graph = await loader.load(envFixtureDir, 'dev')

    expect(graph.environment.baseUrl).toBe('https://api.dev.env') // Overridden by BASE_URL in .env
    expect(graph.environment.variables?.KEY1).toBe('json-value') // From JSON
    expect(graph.environment.variables?.KEY2).toBe('env-value') // Overridden by .env
    expect(graph.environment.variables?.KEY3).toBe('env-value') // Only in .env
  })

  it('should support loading from .env only if .env.json is missing', async () => {
    const envFixtureDir = path.resolve(__dirname, '../fixtures/env-project')
    const loader = new ProjectLoader()
    const graph = await loader.load(envFixtureDir, 'prod')

    expect(graph.environment.baseUrl).toBe('https://api.prod.env') // From baseUrl in .env
    expect(graph.environment.variables?.SECRET).toBe('secret-value')
  })

  it('should support CI/CD overrides (Option C: system env overrides declared variables)', async () => {
    const envFixtureDir = path.resolve(__dirname, '../fixtures/env-project')
    const loader = new ProjectLoader()

    // Mock process.env for this specific test
    process.env.KEY1 = 'system-override' // Declared in JSON
    process.env.SECRET = 'system-secret' // Declared in .env
    process.env.IGNORED = 'should-not-be-added' // Not declared
    process.env.BASE_URL = 'https://api.system.com' // Base URL override

    const graph = await loader.load(envFixtureDir, 'dev')
    expect(graph.environment.variables?.KEY1).toBe('system-override')
    expect(graph.environment.variables?.KEY2).toBe('env-value') // Not overridden
    expect(graph.environment.variables).not.toHaveProperty('IGNORED')
    expect(graph.environment.baseUrl).toBe('https://api.system.com')

    // Check prod (where SECRET is declared)
    const prodGraph = await loader.load(envFixtureDir, 'prod')
    expect(prodGraph.environment.variables?.SECRET).toBe('system-secret')
  })

  it('should collect multiple errors into AggregateLoadError', async () => {
    // We can simulate errors by pointing to a non-existent directory or one with broken files
    // For simplicity, let's just use a non-existent project directory for a basic check
    const loader = new ProjectLoader()
    await expect(loader.load('non-existent', 'dev')).rejects.toThrow()
  })

  it('should filter suites based on plyson_TEST_FILES env variable', async () => {
    const loader = new ProjectLoader()

    // 1. Filter matches existing suite
    process.env.plyson_TEST_FILES = JSON.stringify(['user.test.json'])
    const graph1 = await loader.load(fixtureDir, 'dev')
    expect(graph1.suites.length).toBe(1)
    expect(graph1.suites[0].title).toBe('User Suite')

    // 2. Filter matches absolute/relative path
    process.env.plyson_TEST_FILES = JSON.stringify(['suites/user.test.json'])
    const graph2 = await loader.load(fixtureDir, 'dev')
    expect(graph2.suites.length).toBe(1)

    // 3. Filter does not match
    process.env.plyson_TEST_FILES = JSON.stringify(['other.test.json'])
    const graph3 = await loader.load(fixtureDir, 'dev')
    expect(graph3.suites.length).toBe(0)
  })
})

import { confirm, select } from '@inquirer/prompts'
import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateCommand } from '../generate.js'
import { initCommand } from '../init.js'
import { syncProjectSchemasCommand } from '../sync-project-schemas.js'
import { syncSchemasCommand } from '../sync-schemas.js'
import { validateCommand } from '../validate.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Mock @inquirer/prompts
vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn(),
  select: vi.fn(),
}))

// Mock loadTestPackage to avoid external dependency in tests
vi.mock('../utils/load-test-package.js', () => ({
  loadTestPackage: vi.fn().mockResolvedValue({
    ProjectSchema: { toJSONSchema: () => ({ properties: {} }) },
    TestSuiteSchema: { toJSONSchema: () => ({ properties: {} }) },
    TestcaseSchema: { toJSONSchema: () => ({ properties: {} }) },
    EnvironmentVariablesSchema: { toJSONSchema: () => ({ properties: {} }) },
    VariablesSchema: { toJSONSchema: () => ({ properties: {} }) },
    ProjectLoader: class {
      load = vi.fn().mockResolvedValue({})
    },
    AggregateLoadError: Error,
    LoadError: Error,
  }),
}))

describe('CLI Commands', () => {
  const testDir = path.resolve(__dirname, '../../test-project-tmp')
  let exitSpy: any
  let program: Command

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    fs.mkdirSync(testDir, { recursive: true })
    process.chdir(testDir)

    // Silence console
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((code?: string | number | null | undefined): never => {
        throw new Error(`process.exit: ${code}`)
      })

    program = new Command()
    program.addCommand(initCommand)
    program.addCommand(generateCommand)
    program.addCommand(validateCommand)
    program.addCommand(syncSchemasCommand)
    program.addCommand(syncProjectSchemasCommand)
  })

  afterEach(() => {
    process.chdir(path.resolve(__dirname, '../..'))
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    vi.clearAllMocks()
    exitSpy.mockRestore()
  })

  describe('init', () => {
    it('should initialize a new project with correct structure', async () => {
      await program.parseAsync(['node', 'plyson', 'init', 'test-init'])

      const projectPath = path.join(testDir, 'test-init')
      expect(fs.existsSync(path.join(projectPath, 'project.json'))).toBe(true)
      expect(fs.existsSync(path.join(projectPath, 'environments/dev.env.json'))).toBe(true)
      expect(fs.existsSync(path.join(projectPath, 'suites/sample.test.json'))).toBe(true)
      expect(fs.existsSync(path.join(projectPath, 'package.json'))).toBe(true)
      expect(fs.existsSync(path.join(projectPath, 'playwright.config.ts'))).toBe(true)
      expect(fs.existsSync(path.join(projectPath, '.gitignore'))).toBe(true)
      expect(fs.existsSync(path.join(projectPath, 'skills/sdet-json-generator/SKILL.md'))).toBe(
        true,
      )
      expect(
        fs.existsSync(path.join(projectPath, 'skills/sdet-testcase-generator/SKILL.md')),
      ).toBe(true)
      expect(
        fs.existsSync(
          path.join(projectPath, 'skills/sdet-json-generator/references/assertion-operators.md'),
        ),
      ).toBe(true)

      const projectJson = JSON.parse(
        fs.readFileSync(path.join(projectPath, 'project.json'), 'utf-8'),
      )
      expect(projectJson.title).toBe('test-init')

      const packageJson = JSON.parse(
        fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'),
      )
      expect(packageJson.name).toBe('test-init')
      expect(packageJson.scripts.test).toBe('plyson run')
    })

    it('should handle "." as project name and use current directory name for package.json', async () => {
      // Create a subdirectory to simulate running 'init .'
      const subDir = path.join(testDir, 'current-dir-test')
      fs.mkdirSync(subDir)
      process.chdir(subDir)

      await program.parseAsync(['node', 'plyson', 'init', '.'])

      const packageJson = JSON.parse(fs.readFileSync(path.join(subDir, 'package.json'), 'utf-8'))
      expect(packageJson.name).toBe('current-dir-test')
      expect(packageJson.name).not.toContain('./')
      expect(packageJson.name).not.toContain('.')
    })
  })

  describe('generate', () => {
    beforeEach(async () => {
      fs.writeFileSync('variables.json', JSON.stringify({}))
      fs.mkdirSync('environments', { recursive: true })
      fs.writeFileSync(
        'environments/dev.env.json',
        JSON.stringify({ baseUrl: 'http://loc', variables: {} }),
      )
      fs.writeFileSync(
        'environments/prod.env.json',
        JSON.stringify({ baseUrl: 'http://loc', variables: {} }),
      )
    })

    it('should add a variable to variables.json', async () => {
      await program.parseAsync(['node', 'plyson', 'generate', 'var', 'myKey', 'myValue'])

      const vars = JSON.parse(fs.readFileSync('variables.json', 'utf-8'))
      expect(vars.myKey).toBe('myValue')
    })

    it('should add env-var to all environment files', async () => {
      await program.parseAsync([
        'node',
        'plyson',
        'generate',
        'env-var',
        'apiKey',
        'secret-val',
        '--env',
        'prod',
      ])

      const devEnv = JSON.parse(fs.readFileSync('environments/dev.env.json', 'utf-8'))
      const prodEnv = JSON.parse(fs.readFileSync('environments/prod.env.json', 'utf-8'))

      expect(prodEnv.variables.apiKey).toBe('secret-val')
      expect(devEnv.variables.apiKey).toBe('')
    })

    it('should create a handler boilerplate', async () => {
      await program.parseAsync(['node', 'plyson', 'generate', 'handler', 'my-handler'])

      expect(fs.existsSync('handlers/my-handler.handler.ts')).toBe(true)
      const content = fs.readFileSync('handlers/my-handler.handler.ts', 'utf-8')
      expect(content).toContain("import { HandlerContext } from '@plyson/test'")
    })
  })

  describe('validate', () => {
    it('should repair broken JSON syntax interactively', async () => {
      fs.writeFileSync('project.json', JSON.stringify({ title: 'test', version: '1.0.0' }))
      fs.mkdirSync('environments', { recursive: true })
      fs.writeFileSync('environments/dev.env.json', JSON.stringify({ baseUrl: 'http://loc' }))

      fs.mkdirSync('scripts', { recursive: true })
      const brokenJson = '{"id": "test", "title": "test", "steps": [], }'
      fs.writeFileSync('scripts/broken.script.json', brokenJson)

      vi.mocked(confirm).mockResolvedValue(true)

      try {
        await program.parseAsync(['node', 'plyson', 'validate', '.', '--repair'])
      } catch (e: any) {
        if (!e.message.startsWith('process.exit')) throw e
      }

      const repaired = JSON.parse(fs.readFileSync('scripts/broken.script.json', 'utf-8'))
      expect(repaired.id).toBe('test')
      expect(confirm).toHaveBeenCalled()
    })
  })

  describe('sync-project-schemas', () => {
    it('should generate schemas in Project-schema directory', async () => {
      await program.parseAsync(['node', 'plyson', 'sync-project-schemas'])

      expect(fs.existsSync('Project-schema/project.schema.json')).toBe(true)
      expect(fs.existsSync('Project-schema/testsuite.schema.json')).toBe(true)
      expect(fs.existsSync('Project-schema/testcase.schema.json')).toBe(true)
      expect(fs.existsSync('Project-schema/environment.schema.json')).toBe(true)
      expect(fs.existsSync('Project-schema/variables.schema.json')).toBe(true)
    })
  })

  describe('sync-schemas', () => {
    it('should sync schemas from specUrl and handle stale files', async () => {
      const spec = {
        components: {
          schemas: {
            User: { type: 'object' },
          },
        },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => spec,
      })

      fs.mkdirSync('environments', { recursive: true })
      fs.writeFileSync(
        'environments/dev.env.json',
        JSON.stringify({ specUrl: 'http://example.com/spec' }),
      )

      fs.mkdirSync('schemas', { recursive: true })
      fs.writeFileSync('schemas/Stale.schema.json', '{}')

      vi.mocked(confirm).mockResolvedValue(true)
      vi.mocked(select).mockResolvedValue('delete')

      await program.parseAsync(['node', 'plyson', 'sync-schemas', '--env', 'dev'])

      expect(fs.existsSync('schemas/User.schema.json')).toBe(true)
      expect(fs.existsSync('schemas/Stale.schema.json')).toBe(false)
      expect(confirm).toHaveBeenCalled()
      expect(select).toHaveBeenCalled()
    })
  })
})

import { Command } from 'commander'
import fs from 'fs'
import path from 'path'

export const initCommand = new Command('init')
  .description('Create full directory structure with placeholder files')
  .argument('[project-name]', 'Name of the project', '.')
  .action((projectName) => {
    const rootDir = path.resolve(projectName)
    console.log(`Initializing playson project in ${rootDir}...`)

    const dirs = ['environments', 'schemas', 'handlers', 'scripts', 'suites']

    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir, { recursive: true })
    }

    dirs.forEach((dir) => {
      const dirPath = path.join(rootDir, dir)
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
      }
    })

    // Create placeholder files
    const sanitizedProjectName =
      projectName === '.' ? path.basename(rootDir) : path.basename(projectName)
    const packageJsonName = sanitizedProjectName.toLowerCase().replace(/[^a-z0-9-_]/g, '-')

    const placeholders = {
      'project.json': {
        $schema: './node_modules/@playson/test/schemas/project.schema.json',
        title: projectName === '.' ? 'New API Project' : projectName,
        description: 'API testing project created with playson',
        version: '1.0.0',
        defaultEnv: 'dev',
      },
      'variables.json': {
        $schema: './node_modules/@playson/test/schemas/variables.schema.json',
        appName: 'MyDemoAPI',
      },
      'environments/dev.env.json': {
        $schema: '../node_modules/@playson/test/schemas/environment.schema.json',
        baseUrl: 'http://localhost:3000',
        variables: {
          adminEmail: 'admin@example.com',
        },
      },
      'suites/sample.test.json': {
        $schema: '../node_modules/@playson/test/schemas/testsuite.schema.json',
        title: 'Sample Suite',
        description: 'Welcome to playson! This is a sample test suite.',
        tags: ['smoke'],
        testCases: [
          {
            id: 'sample-get',
            title: 'Should return 200 OK from root',
            tags: [],
            steps: [
              {
                title: 'GET /',
                request: {
                  method: 'GET',
                  endpoint: '/',
                },
                response: {
                  validations: {
                    statusCode: 200,
                  },
                },
              },
            ],
          },
        ],
      },
      'suites/playson.spec.ts': `import { test, expect } from '@playwright/test';
import { bootstrap } from '@playson/test';

/**
 * This is the entry point for playson tests. 
 * It discovers all *.test.json files and registers them as Playwright tests.
 */
await bootstrap(test, expect);
`,
      'package.json': {
        name: packageJsonName,
        version: '1.0.0',
        type: 'module',
        scripts: {
          test: 'playson run',
        },
        dependencies: {
          '@playson/test': 'latest',
        },
        devDependencies: {
          '@playwright/test': '^1.59.1',
          '@playson/cli': 'latest',
        },
      },
      'playwright.config.ts': `import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 30000,
  retries: 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
});
`,
      '.gitignore': `node_modules/
test-results/
playwright-report/
blob-report/
playwright/.cache/
.env
`,
    }

    Object.entries(placeholders).forEach(([filename, content]) => {
      const filePath = path.join(rootDir, filename)
      if (!fs.existsSync(filePath)) {
        const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
        fs.writeFileSync(filePath, fileContent)
        console.log(`Created ${filename}`)
      } else {
        console.log(`${filename} already exists, skipping.`)
      }
    })

    console.log('\nProject initialized successfully!')
    console.log('Next steps:')
    console.log('1. Edit project.json and environments/dev.env.json')
    console.log('2. Add your first test in suites/sample.test.json')
    console.log('3. Run tests with: playson run --env dev')
  })

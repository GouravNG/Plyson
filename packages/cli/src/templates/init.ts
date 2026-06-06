/**
 * Templates for project initialization
 */

export interface InitTemplatesOptions {
  projectName: string
  packageJsonName: string
}

export const getInitTemplates = ({ projectName, packageJsonName }: InitTemplatesOptions) => {
  return {
    'project.json': {
      $schema: './Project-schema/project.schema.json',
      title: projectName === '.' ? 'New API Project' : projectName,
      description: 'API testing project created with plyson',
      version: '1.0.0',
      defaultEnv: 'dev',
    },
    'variables.json': {
      $schema: './Project-schema/variables.schema.json',
      appName: 'MyDemoAPI',
    },
    'environments/dev.env.json': {
      $schema: '../Project-schema/environment.schema.json',
      baseUrl: 'http://localhost:3000',
      variables: {
        adminEmail: 'admin@example.com',
      },
    },
    'actions/hello.action.ts': `import { ActionContext } from '@plyson/test';

/**
 * Sample custom action.
 * Actions are exported as default functions and receive a rich context.
 */
export default async function helloAction({ args, log, store }: ActionContext) {
  const name = args.name || 'World';
  log(\`Hello, \${name}!\`);
  
  // Example: Set a variable that can be used by subsequent steps
  store.set('lastAction', 'hello', 'case');
}
`,
    'suites/sample.test.json': {
      $schema: '../Project-schema/testsuite.schema.json',
      title: 'Sample Suite',
      description: 'Welcome to plyson! This is a sample test suite.',
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
    'suites/plyson.spec.ts': `import { test, expect } from '@playwright/test';
import { bootstrap } from '@plyson/test';

/**
 * This is the entry point for plyson tests. 
 * It discovers all *.test.json files and registers them as Playwright tests.
 */
await bootstrap(test, expect);
`,
    'package.json': {
      name: packageJsonName,
      version: '1.0.0',
      type: 'module',
      scripts: {
        test: 'plyson run',
      },
      dependencies: {
        '@plyson/test': 'latest',
      },
      devDependencies: {
        '@playwright/test': '^1.59.1',
        '@plyson/cli': 'latest',
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
}

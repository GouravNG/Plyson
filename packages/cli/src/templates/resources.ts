/**
 * Templates for handlers, scripts, and suites
 */

export const getHandlerTemplate = (name: string) => `import { HandlerContext } from '@plyson/test';

/**
 * Custom handler: ${name}
 */
export const run = async (ctx: HandlerContext) => {
  // Access request, response, store, etc.
  // Example: const token = ctx.store.get('token');
  // Example: if (ctx.status !== 200) throw new Error('Failed');
  
  console.log('Running handler: ${name}');
};
`

export const getScriptTemplate = (name: string, id: string) => ({
  $schema: '../Project-schema/testcase.schema.json',
  id: id,
  title: name,
  description: `Reusable script: ${name}`,
  tags: ['reusable'],
  steps: [
    {
      title: 'Example step',
      request: {
        method: 'GET',
        endpoint: '/health',
      },
      response: {
        validations: {
          statusCode: 200,
        },
      },
    },
  ],
})

export const getSuiteTemplate = (name: string) => ({
  $schema: '../Project-schema/testsuite.schema.json',
  title: name,
  description: `Test suite: ${name}`,
  tags: ['automated'],
  variables: {},
  testCases: [
    {
      id: `${name.toLowerCase().replace(/\s+/g, '-')}-1`,
      title: 'First test case',
      tags: ['smoke'],
      steps: [
        {
          title: 'Health check',
          request: {
            method: 'GET',
            endpoint: '/health',
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
})

export const getActionTemplate = (name: string) => `import { ActionContext } from '@plyson/test';

/**
 * Custom action: ${name}
 * Actions are exported as default functions and receive a rich context.
 */
export default async function ${name.replace(/[^a-zA-Z0-9]/g, '')}Action({ args, log, store, playwrightRequest }: ActionContext) {
  // Access arguments, store, and Playwright request context
  // Example: const { userId } = args;
  
  log('Running custom action: ${name}');
  
  // Example: Set a variable for subsequent steps
  // store.set('lastAction', '${name}', 'case');
}
`

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
  id: id,
  title: name,
  description: `Reusable script: ${name}`,
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

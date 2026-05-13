import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export const generateCommand = new Command('generate')
  .alias('g')
  .description('Generate resources like variables, handlers, scripts, and suites');

generateCommand
  .command('var <key> [value]')
  .description('Append a variable to variables.json')
  .action((key, value) => {
    const filePath = path.resolve('variables.json');
    let variables: Record<string, any> = {};
    if (fs.existsSync(filePath)) {
      variables = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    variables[key] = value || '';
    fs.writeFileSync(filePath, JSON.stringify(variables, null, 2));
    console.log(`Added variable "${key}" to variables.json`);
  });

generateCommand
  .command('env-var <key> <value>')
  .description('Add a variable to ALL environment files')
  .option('-e, --env <name>', 'Environment where the value is set (others will be null)', 'dev')
  .action(async (key, value, options) => {
    const dirPath = path.resolve('environments');
    if (!fs.existsSync(dirPath)) {
      console.error(`Environments directory not found: ${dirPath}`);
      return;
    }

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.env.json'));
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const envName = path.basename(file, '.env.json');
      const envData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      envData.variables = envData.variables || {};
      envData.variables[key] = (envName === options.env) ? value : '';
      
      fs.writeFileSync(filePath, JSON.stringify(envData, null, 2));
      console.log(`Updated ${file}`);
    }
    console.log(`\nAdded variable "${key}" to all environment files.`);
  });

generateCommand
  .command('handler <name>')
  .description('Create a new handler boilerplate')
  .action((name) => {
    const dirPath = path.resolve('handlers');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const filePath = path.join(dirPath, `${name}.handler.ts`);
    const content = `import { HandlerContext } from '../types/index.js';

/**
 * Custom handler: ${name}
 */
export const run = async (ctx: HandlerContext) => {
  // Access request, response, store, etc.
  // Example: const token = ctx.store.get('token');
  // Example: if (ctx.status !== 200) throw new Error('Failed');
  
  console.log('Running handler: ${name}');
};
`;
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content);
      console.log(`Created handler: ${filePath}`);
    } else {
      console.error(`Handler ${name} already exists.`);
    }
  });

generateCommand
  .command('script <name>')
  .description('Create a new script boilerplate')
  .action((name) => {
    const dirPath = path.resolve('scripts');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const filePath = path.join(dirPath, `${name}.script.json`);
    const id = randomUUID();
    const content = {
      id: id,
      title: name,
      description: `Reusable script: ${name}`,
      steps: [
        {
          title: "Example step",
          request: {
            method: "GET",
            endpoint: "/health"
          },
          response: {
            validations: {
              statusCode: 200
            }
          }
        }
      ]
    };
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
      console.log(`Created script: ${filePath} (id: ${id})`);
    } else {
      console.error(`Script ${name} already exists.`);
    }
  });

generateCommand
  .command('suite <name>')
  .description('Create a new suite boilerplate')
  .action((name) => {
    const dirPath = path.resolve('suites');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const filePath = path.join(dirPath, `${name}.test.json`);
    const content = {
      title: name,
      description: `Test suite: ${name}`,
      tags: ["automated"],
      variables: {},
      testCases: [
        {
          id: `${name.toLowerCase().replace(/\s+/g, '-')}-1`,
          title: "First test case",
          tags: ["smoke"],
          steps: [
            {
              title: "Health check",
              request: {
                method: "GET",
                endpoint: "/health"
              },
              response: {
                validations: {
                  statusCode: 200
                }
              }
            }
          ]
        }
      ]
    };
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
      console.log(`Created suite: ${filePath}`);
    } else {
      console.error(`Suite ${name} already exists.`);
    }
  });

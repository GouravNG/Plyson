#!/usr/bin/env node
import { Command } from 'commander';
import { runCommand } from './commands/run.js';
import { validateCommand } from './commands/validate.js';
import { generateCommand } from './commands/generate.js';
import { syncSchemasCommand } from './commands/sync-schemas.js';
import { initCommand } from './commands/init.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf8')
);

const program = new Command();

program
  .name('playson')
  .description('A declarative API testing framework built on Playwright')
  .version(packageJson.version);

program.addCommand(runCommand);
program.addCommand(validateCommand);
program.addCommand(generateCommand);
program.addCommand(syncSchemasCommand);
program.addCommand(initCommand);

program.parse(process.argv);

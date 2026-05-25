#!/usr/bin/env node
import { Command } from 'commander'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { generateCommand } from './generate.js'
import { initCommand } from './init.js'
import { runCommand } from './run.js'
import { syncProjectSchemasCommand } from './sync-project-schemas.js'
import { syncSchemasCommand } from './sync-schemas.js'
import { validateCommand } from './validate.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'))

const program = new Command()

program
  .name('plyson')
  .description('A declarative API testing framework runs on top of Playwright')
  .version(packageJson.version)

program.addCommand(runCommand)
program.addCommand(validateCommand)
program.addCommand(generateCommand)
program.addCommand(syncSchemasCommand)
program.addCommand(syncProjectSchemasCommand)
program.addCommand(initCommand)

program.parse(process.argv)

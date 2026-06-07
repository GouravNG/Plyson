import { Command } from 'commander'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import {
  getActionTemplate,
  getHandlerTemplate,
  getScriptTemplate,
  getSuiteTemplate,
} from './templates/index.js'

export const generateCommand = new Command('generate')
  .alias('g')
  .description('Generate resources like variables, handlers, actions, scripts, and suites')

generateCommand
  .command('var <key> [value]')
  .description('Append a variable to variables.json')
  .action((key, value) => {
    const filePath = path.resolve('variables.json')
    let variables: Record<string, any> = {}
    
    if (fs.existsSync(filePath)) {
      const { $schema: _, ...rest } = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      variables = rest
    }
    
    variables[key] = value || ''

    // Always enforce/add $schema at the top
    const finalData = {
      $schema: './Project-schema/variables.schema.json',
      ...variables,
    }
    
    fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2))
    console.log(`Added variable "${key}" to variables.json`)
  })

generateCommand
  .command('env-var <key> <value>')
  .description('Add a variable to ALL environment files')
  .option('-e, --env <name>', 'Environment where the value is set (others will be null)', 'dev')
  .action(async (key, value, options) => {
    const dirPath = path.resolve('environments')
    if (!fs.existsSync(dirPath)) {
      console.error(`Environments directory not found: ${dirPath}`)
      return
    }

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.env.json'))

    for (const file of files) {
      const filePath = path.join(dirPath, file)
      const envName = path.basename(file, '.env.json')
      const { $schema: _, ...rest } = JSON.parse(fs.readFileSync(filePath, 'utf8'))

      const envData = rest
      envData.variables = envData.variables || {}
      envData.variables[key] = envName === options.env ? value : ''

      // Always enforce/add $schema at the top
      const finalData = {
        $schema: '../Project-schema/environment.schema.json',
        ...envData,
      }

      fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2))
      console.log(`Updated ${file}`)
    }
    console.log(`\nAdded variable "${key}" to all environment files.`)
  })

generateCommand
  .command('handler <name>')
  .description('Create a new handler boilerplate')
  .action((name) => {
    const dirPath = path.resolve('handlers')
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    const filePath = path.join(dirPath, `${name}.handler.ts`)
    const content = getHandlerTemplate(name)
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content)
      console.log(`Created handler: ${filePath}`)
    } else {
      console.error(`Handler ${name} already exists.`)
    }
  })

generateCommand
  .command('action <name>')
  .description('Create a new custom action boilerplate')
  .action((name) => {
    const dirPath = path.resolve('actions')
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    const filePath = path.join(dirPath, `${name}.action.ts`)
    const content = getActionTemplate(name)
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content)
      console.log(`Created action: ${filePath}`)
    } else {
      console.error(`Action ${name} already exists.`)
    }
  })

generateCommand
  .command('script <name>')
  .description('Create a new script boilerplate')
  .action((name) => {
    const scriptsDir = path.resolve('scripts')
    const filePath = path.join(scriptsDir, `${name}.script.json`)
    const fileDir = path.dirname(filePath)

    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true })
    }

    const id = randomUUID()
    const content = getScriptTemplate(name, id)

    // Adjust $schema path based on depth
    const relativePathToRoot = path.relative(fileDir, path.resolve('.'))
    const schemaPath = path.join(relativePathToRoot, 'Project-schema', 'testcase.schema.json')
    content.$schema = schemaPath.replace(/\\/g, '/')

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2))
      console.log(`Created script: ${filePath} (id: ${id})`)
    } else {
      console.error(`Script ${name} already exists.`)
    }
  })

generateCommand
  .command('suite <name>')
  .description('Create a new suite boilerplate')
  .action((name) => {
    const suitesDir = path.resolve('suites')
    const filePath = path.join(suitesDir, `${name}.test.json`)
    const fileDir = path.dirname(filePath)

    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true })
    }

    const content = getSuiteTemplate(name)

    // Adjust $schema path based on depth
    const relativePathToRoot = path.relative(fileDir, path.resolve('.'))
    const schemaPath = path.join(relativePathToRoot, 'Project-schema', 'testsuite.schema.json')
    content.$schema = schemaPath.replace(/\\/g, '/')

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2))
      console.log(`Created suite: ${filePath}`)
    } else {
      console.error(`Suite ${name} already exists.`)
    }
  })

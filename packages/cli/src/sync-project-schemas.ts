import { Command } from 'commander'
import fs from 'fs'
import { glob } from 'glob'
import path from 'path'
import { loadTestPackage } from './utils/load-test-package.js'

export const syncProjectSchemasCommand = new Command('sync-project-schemas')
  .description('Sync core project JSON schemas to Project-schema/ directory')
  .action(async () => {
    // Load the test package dynamically from the project's node_modules
    const testPkg = await loadTestPackage()

    // Resolve project root from environment variable or current working directory
    const projectRoot = process.env.plyson_ROOT || process.cwd()
    const schemaDir = path.join(projectRoot, 'Project-schema')

    // Create Project-schema directory
    if (!fs.existsSync(schemaDir)) {
      fs.mkdirSync(schemaDir, { recursive: true })
    }

    const schemas = [
      { name: 'project', schema: testPkg.ProjectSchema },
      { name: 'testsuite', schema: testPkg.TestSuiteSchema },
      { name: 'testcase', schema: testPkg.TestcaseSchema },
      { name: 'environment', schema: testPkg.EnvironmentVariablesSchema },
      { name: 'variables', schema: testPkg.VariablesSchema },
    ]

    console.log(`🔄 Syncing core schemas to ${schemaDir}...`)

    // Scan for actions to provide autocomplete
    const actionFiles = await glob('actions/**/*.action.ts', { cwd: projectRoot })
    const actionNames = actionFiles.map((f: string) => path.basename(f, '.action.ts'))

    schemas.forEach(({ name, schema }: { name: string; schema: any }) => {
      try {
        const { $schema, ...restSchema } = schema.toJSONSchema({ target: 'draft-07' })

        let finalSchema: any = {
          $schema: 'http://json-schema.org/draft-07/schema#',
          title: `${name.charAt(0).toUpperCase() + name.slice(1)} Schema`,
          ...restSchema,
          properties: {
            $schema: { type: 'string' },
            ...restSchema.properties,
          },
        }

        // Inject action enums for autocomplete
        if (name === 'testsuite' && actionNames.length > 0) {
          finalSchema = injectActionEnum(finalSchema, actionNames)
        }

        const filePath = path.join(schemaDir, `${name}.schema.json`)
        fs.writeFileSync(filePath, JSON.stringify(finalSchema, null, 2))
        console.log(`✅ Generated: ${name}.schema.json`)
      } catch (error: any) {
        console.error(`❌ Failed to generate ${name}.schema.json: ${error.message}`)
      }
    })

    console.log(`\n✨ Schemas exported to: ${path.relative(projectRoot, schemaDir) || '.'}/`)
  })

/**
 * Deeply searches for 'action' property in the schema and adds enum.
 */
function injectActionEnum(schema: any, actionNames: string[]): any {
  if (typeof schema !== 'object' || schema === null) return schema

  if (schema.properties && schema.properties.action) {
    schema.properties.action.enum = actionNames
  }

  // Recurse into objects/arrays
  for (const key in schema) {
    if (
      key === 'properties' ||
      key === 'anyOf' ||
      key === 'allOf' ||
      key === 'oneOf' ||
      key === 'items'
    ) {
      if (Array.isArray(schema[key])) {
        schema[key].forEach((item: any) => injectActionEnum(item, actionNames))
      } else {
        injectActionEnum(schema[key], actionNames)
      }
    }
  }

  return schema
}

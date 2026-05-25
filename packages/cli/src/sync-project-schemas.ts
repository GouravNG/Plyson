import { Command } from 'commander'
import fs from 'fs'
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

    schemas.forEach(({ name, schema }) => {
      try {
        const { $schema, ...restSchema } = schema.toJSONSchema({ target: 'draft-07' })

        const finalSchema = {
          $schema: 'http://json-schema.org/draft-07/schema#',
          title: `${name.charAt(0).toUpperCase() + name.slice(1)} Schema`,
          ...restSchema,
          properties: {
            $schema: { type: 'string' },
            ...restSchema.properties,
          },
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

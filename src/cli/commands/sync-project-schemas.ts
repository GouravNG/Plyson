import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  ProjectSchema,
  TestSuiteSchema,
  TestcaseSchema,
  EnvironmentVariablesSchema,
  VariablesSchema,
} from '../../types/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const syncProjectSchemasCommand = new Command('sync-project-schemas')
  .description('Sync core project JSON schemas from Zod definitions')
  .action(() => {
    const pkgRoot = path.resolve(__dirname, '../../..')
    const schemaDir = path.join(pkgRoot, 'schemas')

    if (!fs.existsSync(schemaDir)) {
      fs.mkdirSync(schemaDir, { recursive: true })
    }

    const schemas = [
      { name: 'project', schema: ProjectSchema },
      { name: 'testsuite', schema: TestSuiteSchema },
      { name: 'testcase', schema: TestcaseSchema },
      { name: 'environment', schema: EnvironmentVariablesSchema },
      { name: 'variables', schema: VariablesSchema },
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

    console.log('\nCore schema sync complete.')
  })

import { confirm, select } from '@inquirer/prompts'
import { Command } from 'commander'
import fs from 'fs'
import path from 'path'

export const syncSchemasCommand = new Command('sync-schemas')
  .description('Sync schemas from OpenAPI specUrl')
  .option('-e, --env <name>', 'Environment to use', 'dev')
  .option('--all', 'Sync all schemas (default)', true)
  .option('--name <name>', 'Specific schema name to sync')
  .option('--skip-stale', 'Bypass the stale file check')
  .action(async (options) => {
    const envPath = path.resolve('environments', `${options.env}.env.json`)
    if (!fs.existsSync(envPath)) {
      console.error(`Environment file not found: ${envPath}`)
      return
    }

    const env = JSON.parse(fs.readFileSync(envPath, 'utf8'))
    if (!env.specUrl) {
      console.error(`No specUrl found in ${options.env}.env.json`)
      return
    }

    console.log(`🔍 Scanning OpenAPI spec from ${env.specUrl}...`)
    try {
      const response = await fetch(env.specUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch spec: ${response.statusText}`)
      }
      const spec = (await response.json()) as any

      const schemas = spec.components?.schemas || spec.definitions || {}
      const schemaDir = path.resolve('schemas')
      if (!fs.existsSync(schemaDir)) {
        fs.mkdirSync(schemaDir, { recursive: true })
      }

      const remoteNames = Object.keys(schemas)
      const namesToSync = options.name ? [options.name] : remoteNames

      // 1. Scan for changes
      const toUpdate = namesToSync.filter((name) => schemas[name])
      if (toUpdate.length === 0) {
        console.log('No schemas found to sync.')
        return
      }

      console.log(`Found ${toUpdate.length} schema(s) to sync.`)
      const proceed = await confirm({ message: 'Proceed with sync?', default: true })
      if (!proceed) {
        console.log('Sync aborted.')
        return
      }

      // 2. Sync files
      toUpdate.forEach((name) => {
        const schema = JSON.parse(JSON.stringify(schemas[name]))
        rewriteRefs(schema)
        const filePath = path.join(schemaDir, `${name}.schema.json`)
        fs.writeFileSync(filePath, JSON.stringify(schema, null, 2))
        console.log(`✅ Synced: ${name}`)
      })

      // 3. Stale file management
      if (!options.skipStale) {
        const localFiles = fs.readdirSync(schemaDir).filter((f) => f.endsWith('.schema.json'))
        const staleFiles = localFiles.filter(
          (f) => !remoteNames.includes(path.basename(f, '.schema.json')),
        )

        if (staleFiles.length > 0) {
          console.log(`\n⚠️  Found ${staleFiles.length} stale schema file(s) (not in remote spec).`)
          for (const file of staleFiles) {
            const action = await select({
              message: `Action for stale file "${file}":`,
              choices: [
                { name: 'Keep it', value: 'keep' },
                { name: 'Delete it', value: 'delete' },
                { name: 'Abort sync', value: 'abort' },
              ],
            })

            if (action === 'delete') {
              fs.unlinkSync(path.join(schemaDir, file))
              console.log(`🗑️  Deleted ${file}`)
            } else if (action === 'abort') {
              console.log('Sync aborted.')
              return
            }
          }
        }
      }

      console.log('\nSchema sync complete.')
      console.log(
        '\n💡 Note: Schema validation will work as expected if "required" node present with valid keys and additionalProperties is true.',
      )
    } catch (error: any) {
      console.error(`Error syncing schemas: ${error.message}`)
    }
  })

/**
 * Recursively rewrites internal OpenAPI references (#/components/schemas/X)
 * to local file references (X.schema.json).
 */
function rewriteRefs(obj: any) {
  if (!obj || typeof obj !== 'object') return

  if (obj.$ref && typeof obj.$ref === 'string') {
    if (obj.$ref.startsWith('#/components/schemas/') || obj.$ref.startsWith('#/definitions/')) {
      const parts = obj.$ref.split('/')
      const name = parts[parts.length - 1]
      obj.$ref = `${name}.schema.json`
    }
  }

  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object') {
      rewriteRefs(obj[key])
    }
  }
}

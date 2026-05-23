import { confirm, select } from '@inquirer/prompts'
import { AggregateLoadError, LoadError, ProjectLoader } from '@playson/test'
import { Command } from 'commander'
import { existsSync } from 'fs'
import fs from 'fs/promises'
import { jsonrepair } from 'jsonrepair'
import path from 'path'

export const validateCommand = new Command('validate')
  .description('Validate the project structure and files')
  .argument('[path]', 'Path to a specific file or the project root', '.')
  .option('-e, --env <environment>', 'Environment to validate against')
  .option(
    '-t, --type <type>',
    'Target specific categories: project, suite, script, handler, env, var',
  )
  .option('--repair', 'Interactively repair broken files and links')
  .action(async (targetPath, options) => {
    const rootDir = process.cwd()
    const env = options.env || 'dev'
    const loader = new ProjectLoader()

    try {
      if (options.repair) {
        await handleRepair(targetPath, rootDir, env)
      } else {
        console.log(`Validating project at ${targetPath} (env: ${env})...`)
        const effectiveRoot =
          existsSync(targetPath) && (await fs.stat(targetPath)).isDirectory() ? targetPath : rootDir

        await loader.load(effectiveRoot, env)
        console.log('✅ Project is valid!')
      }
    } catch (error) {
      if (error instanceof AggregateLoadError) {
        console.error(`\n❌ Validation failed with ${error.errors.length} error(s):`)
        error.errors.forEach((err: LoadError, index: number) => {
          const fileInfo = err.file ? ` [${err.file}]` : ''
          console.error(`${index + 1}. ${err.message}${fileInfo}`)
        })

        if (!options.repair) {
          console.log('\nTip: Use --repair to interactively fix some of these issues.')
        }
        process.exit(1)
      } else if (error instanceof Error) {
        console.error(`\n❌ Error during validation: ${error.message}`)
        process.exit(1)
      } else {
        console.error('\n❌ An unknown error occurred during validation.')
        process.exit(1)
      }
    }
  })

async function handleRepair(_targetPath: string, rootDir: string, env: string) {
  console.log('🔧 Entering interactive repair mode...')

  // 1. Repair JSON syntax issues
  const jsonFiles = await findJsonFiles(rootDir)
  for (const file of jsonFiles) {
    try {
      const content = await fs.readFile(file, 'utf-8')
      try {
        JSON.parse(content)
      } catch (e) {
        console.log(`\n⚠️  Found JSON syntax error in ${path.relative(rootDir, file)}`)
        const repaired = jsonrepair(content)
        console.log('Proposed fix:')
        console.log(repaired)

        const shouldFix = await confirm({ message: `Apply this fix to ${path.basename(file)}?` })
        if (shouldFix) {
          await fs.writeFile(file, repaired, 'utf-8')
          console.log('✅ File repaired.')
        }
      }
    } catch (e) {
      // Skip files we can't read
    }
  }

  // 2. Run loader to find higher-level issues (broken refs, missing variables)
  const loader = new ProjectLoader()
  try {
    await loader.load(rootDir, env)
    console.log('\n✅ Project is now valid!')
  } catch (error) {
    if (error instanceof AggregateLoadError) {
      for (const err of error.errors) {
        await repairSpecificError(err, rootDir)
      }

      // Run validation one last time
      try {
        await loader.load(rootDir, env)
        console.log('\n✅ All repairable issues resolved. Project is valid!')
      } catch (e) {
        console.log('\n⚠️  Some issues still remain. Please check the logs.')
      }
    } else {
      throw error
    }
  }
}

async function findJsonFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  let files: string[] = []
  for (const entry of entries) {
    const res = path.resolve(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        files = files.concat(await findJsonFiles(res))
      }
    } else if (entry.name.endsWith('.json')) {
      files.push(res)
    }
  }
  return files
}

async function repairSpecificError(err: LoadError, rootDir: string) {
  if (err.message.includes('Ref') && err.message.includes('not found')) {
    const match = err.message.match(/Ref "(.*)" not found/)
    if (match) {
      const ref = match[1]
      console.log(`\n⚠️  Broken Ref: "${ref}" not found in ${err.file}`)

      const action = await select({
        message: 'How would you like to handle this?',
        choices: [
          { name: 'Skip for now', value: 'skip' },
          { name: 'Remove the step', value: 'remove' },
        ],
      })

      if (action === 'remove' && err.file) {
        const filePath = path.join(rootDir, err.file)
        const content = JSON.parse(await fs.readFile(filePath, 'utf-8'))

        if (content.steps) {
          content.steps = content.steps.filter((s: any) => s.ref !== ref)
        } else if (content.testCases) {
          content.testCases.forEach((tc: any) => {
            tc.steps = tc.steps.filter((s: any) => s.ref !== ref)
          })
        }

        await fs.writeFile(filePath, JSON.stringify(content, null, 2))
        console.log('✅ Step removed.')
      }
    }
  }
}

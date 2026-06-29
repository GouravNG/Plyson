import { spawn } from 'child_process'
import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import { loadTestPackage } from './utils/load-test-package.js'

export const runCommand = new Command('run')
  .description('Run plyson tests via Playwright')
  .argument('[paths...]', 'Specific test paths to run')
  .option('-e, --env <name>', 'Environment to use')
  .allowUnknownOption()
  .action(async (_paths, options) => {
    const rootDir = process.cwd()
    let env = options.env

    // Try to load project.json to find defaultEnv if not specified
    if (!env) {
      const projectPath = path.join(rootDir, 'project.json')
      if (fs.existsSync(projectPath)) {
        try {
          const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'))
          env = project.defaultEnv
        } catch (e) {
          // Ignore parse errors here, loader will catch them later
        }
      }
    }

    if (!env) {
      console.error(
        'Error: Environment is required. Use --env <name> or set defaultEnv in project.json',
      )
      process.exit(1)
    }

    console.log(`Pre-compiling project graph for environment "${env}"...`)
    try {
      const testPackage = await loadTestPackage()
      const loader = new testPackage.ProjectLoader()
      const graph = await loader.load(rootDir, env, { skipModules: true })
      const manifestDir = path.join(rootDir, '.plyson')
      if (!fs.existsSync(manifestDir)) {
        fs.mkdirSync(manifestDir, { recursive: true })
      }
      const manifestPath = path.join(manifestDir, 'manifest.json')
      fs.writeFileSync(manifestPath, testPackage.ProjectLoader.serialize(graph), 'utf8')
    } catch (e: any) {
      console.error(`Error during test discovery: ${e.message}`)
      process.exit(1)
    }

    const envVars: Record<string, string | undefined> = {
      ...process.env,
      plyson_ROOT: rootDir,
      plyson_ENV: env,
      plyson_USE_MANIFEST: 'true',
    }

    // Prepare playwright arguments
    // We want to pass everything that wasn't consumed by our options.

    // Construct the playwright test command arguments
    const playwrightArgs = ['test']

    // Add all arguments passed to this command, excluding --env/-e and its value, and the specific test paths
    const rawArgs = process.argv.slice(process.argv.indexOf('run') + 1)
    const paths = (_paths || []).filter((p: string) => fs.existsSync(p) || p.endsWith('.json'))
    for (let i = 0; i < rawArgs.length; i++) {
      const arg = rawArgs[i]
      if (arg === '--env' || arg === '-e') {
        i++ // skip value
        continue
      }
      if (paths.includes(arg)) {
        continue
      }
      playwrightArgs.push(arg)
    }

    if (paths.length > 0) {
      envVars.plyson_TEST_FILES = JSON.stringify(paths)
    }

    console.log(`Running plyson tests in "${env}" environment...`)

    const child = spawn('npx', ['playwright', ...playwrightArgs], {
      stdio: 'inherit',
      env: envVars,
      shell: true,
    })

    child.on('exit', (code) => {
      process.exit(code ?? 0)
    })
  })

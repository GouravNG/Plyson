import { Command } from 'commander'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

export const runCommand = new Command('run')
  .description('Run play-son tests via Playwright')
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
        'Error: Environment is required. Use --env <name> or set defaultEnv in project.json'
      )
      process.exit(1)
    }

    const envVars = {
      ...process.env,
      PLAYSON_ROOT: rootDir,
      PLAYSON_ENV: env,
    }

    // Prepare playwright arguments
    // We want to pass everything that wasn't consumed by our options.

    // Construct the playwright test command arguments
    const playwrightArgs = ['test']

    // Add all arguments passed to this command, excluding --env/-e and its value
    const rawArgs = process.argv.slice(process.argv.indexOf('run') + 1)
    for (let i = 0; i < rawArgs.length; i++) {
      const arg = rawArgs[i]
      if (arg === '--env' || arg === '-e') {
        i++ // skip value
        continue
      }
      playwrightArgs.push(arg)
    }

    console.log(`Running play-son tests in "${env}" environment...`)

    const child = spawn('npx', ['playwright', ...playwrightArgs], {
      stdio: 'inherit',
      env: envVars,
      shell: true,
    })

    child.on('exit', (code) => {
      process.exit(code ?? 0)
    })
  })

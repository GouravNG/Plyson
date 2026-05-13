import { Command } from 'commander';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const runCommand = new Command('run')
  .description('Run play-son tests via Playwright')
  .argument('[paths...]', 'Specific test paths to run')
  .option('-e, --env <name>', 'Environment to use')
  .allowUnknownOption()
  .action(async (paths, options) => {
    const rootDir = process.cwd();
    let env = options.env;

    // Try to load project.json to find defaultEnv if not specified
    if (!env) {
      const projectPath = path.join(rootDir, 'project.json');
      if (fs.existsSync(projectPath)) {
        try {
          const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
          env = project.defaultEnv;
        } catch (e) {
          // Ignore parse errors here, loader will catch them later
        }
      }
    }

    if (!env) {
      console.error('Error: Environment is required. Use --env <name> or set defaultEnv in project.json');
      process.exit(1);
    }

    // Path to the playwright-runner.js
    const runnerPath = path.resolve(__dirname, '../../core/playwright-runner.js');
    
    const envVars = {
      ...process.env,
      PLAYSON_ROOT: rootDir,
      PLAYSON_ENV: env
    };

    // Prepare playwright arguments
    // We want to pass everything that wasn't consumed by our options.
    // commander.args contains paths and unknown options.
    
    // Construct the playwright test command arguments
    const playwrightArgs = ['test', runnerPath];
    
    // Add paths if provided
    if (paths && paths.length > 0) {
      playwrightArgs.push(...paths);
    }

    // Add all other arguments passed to this command, excluding --env/-e and its value
    const rawArgs = process.argv.slice(process.argv.indexOf('run') + 1);
    for (let i = 0; i < rawArgs.length; i++) {
      const arg = rawArgs[i];
      if (arg === '--env' || arg === '-e') {
        i++; // skip value
        continue;
      }
      // If it's a path we already added, or it was the 'run' command itself, skip it
      if (paths.includes(arg)) continue;
      
      playwrightArgs.push(arg);
    }

    console.log(`Running play-son tests in "${env}" environment...`);

    const child = spawn('npx', ['playwright', ...playwrightArgs], {
      stdio: 'inherit',
      env: envVars,
      shell: true
    });

    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });
  });

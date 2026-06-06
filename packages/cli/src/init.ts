import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getInitTemplates } from './templates/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const skillTemplatesDir = path.resolve(__dirname, 'templates/skills')

const copyDirectoryContents = (sourceDir: string, targetDir: string): number => {
  if (!fs.existsSync(sourceDir)) {
    return 0
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  let copiedFiles = 0

  fs.readdirSync(sourceDir, { withFileTypes: true }).forEach((entry) => {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      copiedFiles += copyDirectoryContents(sourcePath, targetPath)
      return
    }

    if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(sourcePath, targetPath)
      copiedFiles += 1
    }
  })

  return copiedFiles
}

export const initCommand = new Command('init')
  .description('Create full directory structure with placeholder files')
  .argument('[project-name]', 'Name of the project', '.')
  .action((projectName) => {
    const rootDir = path.resolve(projectName)
    console.log(`Initializing plyson project in ${rootDir}...`)

    const dirs = ['environments', 'schemas', 'handlers', 'actions', 'scripts', 'suites']

    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir, { recursive: true })
    }

    dirs.forEach((dir) => {
      const dirPath = path.join(rootDir, dir)
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
      }
    })

    // Create placeholder files
    const sanitizedProjectName =
      projectName === '.' ? path.basename(rootDir) : path.basename(projectName)
    const packageJsonName = sanitizedProjectName.toLowerCase().replace(/[^a-z0-9-_]/g, '-')

    const placeholders = getInitTemplates({ projectName, packageJsonName })

    Object.entries(placeholders).forEach(([filename, content]) => {
      const filePath = path.join(rootDir, filename)
      if (!fs.existsSync(filePath)) {
        const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
        fs.writeFileSync(filePath, fileContent)
        console.log(`Created ${filename}`)
      } else {
        console.log(`${filename} already exists, skipping.`)
      }
    })

    const copiedSkillFiles = copyDirectoryContents(skillTemplatesDir, path.join(rootDir, 'skills'))
    if (copiedSkillFiles > 0) {
      console.log('Created skills')
    } else {
      console.log('skills already exists, skipping.')
    }

    console.log('\nProject initialized successfully!')
    console.log('Next steps:')
    if (projectName !== '.') {
      console.log(`1. cd ${projectName}`)
      console.log('2. npm install')
      console.log('3. plyson sync-project-schemas')
    } else {
      console.log('1. npm install')
      console.log('2. plyson sync-project-schemas')
    }
    console.log(
      `${projectName !== '.' ? '4' : '3'}. Edit project.json and environments/dev.env.json`,
    )
    console.log(
      `${projectName !== '.' ? '5' : '4'}. Add your first test in suites/sample.test.json`,
    )
    console.log(`${projectName !== '.' ? '6' : '5'}. Run tests with: plyson run --env dev`)
  })

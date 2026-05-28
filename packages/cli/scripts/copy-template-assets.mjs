import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '..')
const sourceDir = path.join(packageRoot, 'src/templates/skills')
const targetDir = path.join(packageRoot, 'dist/templates/skills')

if (!fs.existsSync(sourceDir)) {
  process.exit(0)
}

fs.rmSync(targetDir, { recursive: true, force: true })
fs.mkdirSync(path.dirname(targetDir), { recursive: true })
fs.cpSync(sourceDir, targetDir, { recursive: true })

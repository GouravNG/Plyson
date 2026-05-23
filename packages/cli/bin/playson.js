#!/usr/bin/env node
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const entry = join(__dirname, '../dist/index.js')

if (!existsSync(entry)) {
  console.error('Playson CLI has not been built yet. Run "pnpm --filter @playson/cli build" first.')
  process.exit(1)
}

await import(pathToFileURL(entry).href)

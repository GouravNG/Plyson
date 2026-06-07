import type { APIResponse } from '@playwright/test'
import pc from 'picocolors'
import { ExtractionError } from '../errors/index.js'
import { pathEngine } from '../path/index.js'
import { ExtractedValue } from '../types/index.js'
import { Logger } from './logger.js'
import { VariableStore } from './variable-store.js'

export class ExtractionEngine {
  /**
   * Extracts a value from the response and writes it to the VariableStore.
   */
  static runExtraction(
    extraction: ExtractedValue,
    body: unknown,
    response: APIResponse,
    store: VariableStore,
    logger?: Logger,
  ): void {
    const value =
      extraction.from === 'header'
        ? pathEngine.extractHeader(response, extraction.path)
        : pathEngine.extract(body, extraction.path)

    if (value === undefined) {
      throw new ExtractionError(
        `Path "${extraction.path}" returned undefined — cannot extract "${extraction.name}"`,
      )
    }

    if (logger) {
      const logLines = [
        pc.bold('extraction:'),
        `    Path with ${pc.cyan(extraction.path)} found with value ${pc.green(JSON.stringify(value))}`,
        `    storing in variable named ${pc.cyan(extraction.name)} at ${pc.yellow(extraction.scope)}`,
      ]
      logger.info(logLines.join('\n'))
    }

    store.set(extraction.name, value, extraction.scope)
  }
}

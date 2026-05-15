import type { APIResponse } from '@playwright/test'
import { ExtractedValue } from '../types/index.js'
import { pathEngine } from '../path/index.js'
import { VariableStore } from './variable-store.js'
import { ExtractionError } from '../errors/index.js'

export class ExtractionEngine {
  /**
   * Extracts a value from the response and writes it to the VariableStore.
   */
  static runExtraction(
    extraction: ExtractedValue,
    body: unknown,
    response: APIResponse,
    store: VariableStore
  ): void {
    const value =
      extraction.from === 'header'
        ? pathEngine.extractHeader(response, extraction.path)
        : pathEngine.extract(body, extraction.path)

    if (value === undefined) {
      throw new ExtractionError(
        `Path "${extraction.path}" returned undefined — cannot extract "${extraction.name}"`
      )
    }

    store.set(extraction.name, value, extraction.scope)
  }
}

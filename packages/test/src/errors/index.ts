export abstract class PlaysonError extends Error {
  abstract readonly code: string
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class LoadError extends PlaysonError {
  readonly code = 'LOAD_ERROR'
  constructor(
    message: string,
    public file?: string,
  ) {
    super(file ? `${message} (file: ${file})` : message)
  }
}

export class AggregateLoadError extends Error {
  constructor(public errors: LoadError[]) {
    const errorList = errors.map((e) => `  - ${e.message}`).join('\n')
    super(`Failed to load project with ${errors.length} errors:\n${errorList}`)
    this.name = 'AggregateLoadError'
  }
}

export class ResolutionError extends PlaysonError {
  readonly code = 'RESOLUTION_ERROR'
  constructor(
    public token: string,
    public stepTitle: string,
  ) {
    super(`Failed to resolve token "{{${token}}}" in step "${stepTitle}"`)
  }
}

export class AssertionError extends PlaysonError {
  readonly code = 'ASSERTION_ERROR'
  constructor(
    public assertionTitle: string,
    public cause?: unknown,
  ) {
    super(`Assertion failed: "${assertionTitle}"${cause ? ` - ${cause}` : ''}`)
  }
}

export class ExtractionError extends PlaysonError {
  readonly code = 'EXTRACTION_ERROR'
  constructor(message: string) {
    super(message)
  }
}

export class SchemaValidationError extends PlaysonError {
  readonly code = 'SCHEMA_VALIDATION_ERROR'
  constructor(
    public schemaName: string,
    public validationErrors: any[],
  ) {
    super(`Schema validation failed for "${schemaName}": ${JSON.stringify(validationErrors)}`)
  }
}

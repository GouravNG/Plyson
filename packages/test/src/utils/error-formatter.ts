import pc from 'picocolors'

export interface AjvError {
  instancePath: string
  keyword: string
  message?: string
  params?: Record<string, any>
  data?: any
}

/**
 * Normalizes AJV instancePath (e.g., "/user/firstname" or "/items/0/price")
 * to a user-friendly format (e.g., "user>firstname" or "items>0>price").
 */
function normalizePath(path: string): string {
  if (!path || path === '/') return 'root'
  // Remove leading slash and replace internal slashes with '>'
  return path.replace(/^\//, '').replace(/\//g, '>')
}

/**
 * Formats AJV validation errors into a human-readable string.
 */
export function formatAjvErrors(errors: AjvError[]): string {
  if (!Array.isArray(errors)) return String(errors)

  return errors
    .map((err) => {
      const path = normalizePath(err.instancePath)
      const msg = err.message || 'invalid'

      // Custom formatting for common keywords to match user preference
      if (err.keyword === 'type') {
        return `Expected ${pc.cyan(path)} to be ${pc.yellow(err.params?.type)}, but it is not.`
      }
      if (err.keyword === 'required') {
        const missingProp = err.params?.missingProperty
        const fullPath = path === 'root' ? missingProp : `${path}>${missingProp}`
        return `Missing required property ${pc.red(missingProp)} at ${pc.cyan(fullPath)}`
      }
      if (err.keyword === 'additionalProperties') {
        const extraProp = err.params?.additionalProperty
        const fullPath = path === 'root' ? extraProp : `${path}>${extraProp}`
        return `Unrecognized property ${pc.red(extraProp)} found at ${pc.cyan(fullPath)}`
      }

      return `${pc.cyan(path)}: ${msg} (${pc.dim(err.keyword)})`
    })
    .join('\n')
}

/**
 * Formats Error objects, specifically handling Playwright/Jest expectation failures
 * and stripping unnecessary stack traces for warnings.
 */
export function formatError(err: any, stripStack = false): string {
  if (err instanceof Error) {
    if (stripStack) {
      // Return only the message (which includes the diff for Playwright errors)
      return err.message
    }
    return err.stack || err.message
  }

  // Check if it's an array of AJV errors
  if (Array.isArray(err) && err.length > 0 && err[0].instancePath !== undefined) {
    return formatAjvErrors(err as AjvError[])
  }

  if (typeof err === 'object') {
    try {
      return JSON.stringify(err, null, 2)
    } catch {
      return String(err)
    }
  }

  return String(err)
}

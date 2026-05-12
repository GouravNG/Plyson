import { JSONPath } from 'jsonpath-plus'
import jmespath from 'jmespath'
import { APIResponse } from '@playwright/test'

export class PathEngine {
  /**
   * Extracts a value from a source object using either JSONPath or JMESPath.
   * Paths starting with '$' are treated as JSONPath, others as JMESPath.
   */
  extract(source: unknown, path: string): unknown {
    if (path.startsWith('$')) {
      return this.extractJsonPath(source, path)
    }
    return this.extractJmesPath(source, path)
  }

  private extractJsonPath(source: any, path: string): unknown {
    const result = JSONPath({ path, json: source, wrap: true }) as any[]

    // filter expressions always return the full array so isEmpty/isNotEmpty work correctly
    if (this.isFilterExpression(path)) {
      return result
    }

    // single-value paths — unwrap from the array
    return result.length === 1 ? result[0] : result
  }

  private isFilterExpression(path: string): boolean {
    return path.includes('[?(')
  }

  private extractJmesPath(source: unknown, path: string): unknown {
    const result = jmespath.search(source, path)
    // normalise jmespath null → undefined
    return result === null ? undefined : result
  }

  /**
   * Extracts a header value from the response. Key is case-insensitive.
   */
  extractHeader(response: APIResponse, key: string): string | undefined {
    return response.headers()[key.toLowerCase()]
  }
}

export const pathEngine = new PathEngine()

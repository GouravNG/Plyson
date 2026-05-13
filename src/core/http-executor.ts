import { APIRequestContext, APIResponse } from '@playwright/test'
import { Req, ResolvedStep } from '../types/index.js'
import { generateFromSchema } from '../autofill/schema-generator.js'
import { LoadError } from '../errors/index.js'

export interface ResolvedRequest extends Req {}

export class HttpExecutor {
  constructor(
    private context: APIRequestContext,
    private baseUrl: string,
    private schemas: Map<string, any>
  ) {}

  /**
   * Executes a resolved test step using Playwright's APIRequestContext.
   */
  async execute(step: ResolvedStep): Promise<APIResponse> {
    const endpoint = this.applyPathParams(step.request.endpoint, step.request.pathParams ?? {})
    const url = this.baseUrl + endpoint
    const headers = this.applyFlags(step.flags ?? [], step.request.headers ?? {})
    const payload = this.buildPayload(step, this.schemas)

    return this.context.fetch(url, {
      method: step.request.method,
      headers,
      params: step.request.queryParams,
      data: Object.keys(payload).length > 0 ? payload : undefined,
    })
  }

  private applyPathParams(endpoint: string, params: Record<string, any>): string {
    return Object.entries(params).reduce(
      (url, [key, val]) => url.replace(`:${key}`, encodeURIComponent(String(val))),
      endpoint
    )
  }

  private applyFlags(flags: string[], headers: Record<string, any>): Record<string, any> {
    const result = { ...headers }
    if (flags.includes('skip_auth')) {
      delete result['Authorization']
      delete result['authorization']
    }
    return result
  }

  private buildPayload(step: ResolvedStep, schemas: Map<string, any>): Record<string, any> {
    if (!step.request.autoFill) {
      return step.request.payload ?? {}
    }

    const { schemaName, ...filterConfig } = step.request.autoFill
    const schema = schemas.get(schemaName)
    if (!schema) {
      throw new LoadError(`Schema "${schemaName}" not found`, 'http-executor')
    }

    const generated = generateFromSchema(schema, filterConfig)
    // Explicit payload wins over generated values
    return { ...generated, ...step.request.payload }
  }
}

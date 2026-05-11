import { APIRequestContext, APIResponse } from '@playwright/test'
import { Req, ResolvedStep } from '../types'

export interface ResolvedRequest extends Omit<Req, 'endpoint'> {
  url: string
}

export class HttpExecutor {
  constructor(
    private context: APIRequestContext,
    private baseUrl: string,
    private schemas: Map<string, any>
  ) {}
  async execute(step: ResolvedStep): Promise<APIResponse> {
    throw new Error('Not implemented')
  }
}

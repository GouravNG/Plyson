import { APIResponse } from '@playwright/test'
import { HandlerModule, VariableValue, Scope } from '../types'
import { LoadError } from '../errors'
import { ResolvedRequest } from './http-executor'

export interface HandlerContext {
  request: ResolvedRequest
  response: APIResponse
  body: unknown
  status: number
  store: {
    get: (name: string) => VariableValue | undefined
    set: (name: string, value: VariableValue, scope: Scope) => void
  }
  warn: (title: string, message: string) => void
}

export class HandlerRunner {
  /**
   * Runs a list of handlers in order.
   */
  static async runHandlers(
    handlerNames: string[],
    ctx: HandlerContext,
    handlers: Map<string, HandlerModule>
  ): Promise<void> {
    for (const name of handlerNames) {
      const mod = handlers.get(name)
      if (!mod) {
        throw new LoadError(`Handler "${name}" not found — check handlers/ directory`)
      }
      await mod.run(ctx)
    }
  }
}

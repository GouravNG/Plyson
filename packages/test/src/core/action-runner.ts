import type { APIRequestContext } from '@playwright/test'
import { ActionContext, ActionModule, ActionStep, Scope, VariableValue } from '../types/index.js'
import { Logger } from './logger.js'
import { Resolver } from './resolver.js'
import { VariableStore } from './variable-store.js'

export class ActionRunner {
  constructor(
    private playwrightRequest: APIRequestContext,
    private store: VariableStore,
    private actions: Map<string, ActionModule>,
    private logger: Logger,
  ) {}

  async runAction(step: ActionStep): Promise<void> {
    const actionMod = this.actions.get(step.action)
    if (!actionMod) {
      throw new Error(`Action "${step.action}" not found — check actions/ directory`)
    }

    const resolver = new Resolver(this.store, step.title)
    const resolvedArgs = step.args ? resolver.resolve(step.args) : {}

    const ctx: ActionContext = {
      args: resolvedArgs,
      store: {
        get: (name: string) => this.store.get(name),
        set: (name: string, value: VariableValue, scope: Scope) =>
          this.store.set(name, value, scope),
      },
      log: (message: string) => this.logger.info(`[Action: ${step.action}] ${message}`),
      warn: (title: string, message: any) => this.logger.warn(title, message),
      error: (message: any) => {
        this.logger.error(message)
        throw message instanceof Error ? message : new Error(String(message))
      },
      playwrightRequest: this.playwrightRequest,
    }

    if (typeof actionMod.default !== 'function') {
      throw new Error(`Action "${step.action}" must have a default export function`)
    }

    await actionMod.default(ctx)
  }
}

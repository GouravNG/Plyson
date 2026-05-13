import { faker } from '@faker-js/faker'
import { Scope, Variables, VariableValue } from '../types/index.js'

const RESERVED_GLOBALS: Record<string, () => any> = {
  $timestamp: () => Date.now(),
  $isoDate: () => new Date().toISOString(),
  $guid: () => faker.string.uuid(),
}

export class VariableStore {
  private layers: Record<Scope, Variables> = {
    global: {},
    environment: {},
    suite: {},
    case: {},
  }

  /**
   * Replace the entire scope with new variables.
   */
  push(scope: Scope, vars: Variables): void {
    this.layers[scope] = { ...vars }
  }

  /**
   * Reset the scope to an empty object.
   */
  pop(scope: Scope): void {
    this.layers[scope] = {}
  }

  /**
   * Get a variable value by name, checking reserved globals first,
   * then walking through scopes in priority order: case > suite > environment > global.
   */
  get(name: string): VariableValue | undefined {
    if (name in RESERVED_GLOBALS) {
      return RESERVED_GLOBALS[name]()
    }

    const priority: Scope[] = ['case', 'suite', 'environment', 'global']
    for (const scope of priority) {
      if (name in this.layers[scope]) {
        return this.layers[scope][name]
      }
    }

    return undefined
  }

  /**
   * Set a variable in a specific scope.
   */
  set(name: string, value: any, scope: Scope): void {
    this.layers[scope][name] = value
  }

  /**
   * Return a flattened object of all variables, with later scopes overwriting earlier ones.
   */
  snapshot(): Variables {
    return {
      ...this.layers.global,
      ...this.layers.environment,
      ...this.layers.suite,
      ...this.layers.case,
    }
  }
}

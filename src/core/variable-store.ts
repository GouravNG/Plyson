import { Scope, Variables, VariableValue } from '../types'

export class VariableStore {
  push(scope: Scope, vars: Variables): void {}
  pop(scope: Scope): void {}
  get(name: string): VariableValue | undefined {
    return undefined
  }
  set(name: string, value: VariableValue, scope: Scope): void {}
  snapshot(): Variables {
    return {}
  }
}

import { VariableStore } from './variable-store'
import { Req, Variables } from '../types'

export class Resolver {
  constructor(
    private store: VariableStore,
    private stepTitle: string = ''
  ) {}
  resolve<T>(input: T): T {
    return input
  }
}

export function resolvePhase1(variables: Variables, store: VariableStore): Variables {
  return {}
}
export function resolvePhase2(request: Req, store: VariableStore, stepTitle: string): Req {
  return request
}

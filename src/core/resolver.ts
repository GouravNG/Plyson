import { ResolutionError } from '../errors'
import { GeneratorRegistry } from '../generators/registry'
import { GeneratorObject, Req, Variables, VariableValue } from '../types'
import { isGenObject } from '../utils/is-gen-object'
import { VariableStore } from './variable-store'

const TOKEN_RE = /\{\{\s*(.*?)\s*\}\}/g

export class Resolver {
  private depth = 0
  private readonly MAX_DEPTH = 10

  constructor(
    private store: VariableStore,
    private stepTitle = ''
  ) {}

  /**
   * Walk the value recursively and resolve tokens and generators.
   */
  resolve<T>(input: T): T {
    if (input === null || input === undefined) {
      return input
    }

    if (isGenObject(input)) {
      return this.executeGenerator(input) as T
    }

    if (typeof input === 'string') {
      return this.resolveString(input) as T
    }

    if (Array.isArray(input)) {
      return input.map((v) => this.resolve(v)) as unknown as T
    }

    if (typeof input === 'object') {
      // Plain object
      const entries = Object.entries(input as object)
      const resolvedEntries = entries.map(([k, v]) => [k, this.resolve(v)])
      return Object.fromEntries(resolvedEntries) as T
    }

    return input
  }

  /**
   * Resolve tokens within a string.
   */
  private resolveString(input: string): VariableValue {
    const tokens = [...input.matchAll(TOKEN_RE)]
    if (tokens.length === 0) {
      return input
    }

    // Single-token path — preserve original type if the entire string is just the token
    const trimmedInput = input.trim()
    const singleTokenMatch = trimmedInput.match(/^\{\{\s*(.*?)\s*\}\}$/)
    if (singleTokenMatch) {
      const tokenName = singleTokenMatch[1].trim()
      const value = this.store.get(tokenName)
      if (value === undefined) {
        throw new ResolutionError(tokenName, this.stepTitle)
      }
      return value
    }

    // Mixed/multi-token — always string
    return input.replace(TOKEN_RE, (_, name) => {
      const trimmed = name.trim()
      const value = this.store.get(trimmed)
      if (value === undefined) {
        throw new ResolutionError(trimmed, this.stepTitle)
      }
      return String(value)
    })
  }

  /**
   * Execute a generator object.
   */
  private executeGenerator(gen: GeneratorObject): VariableValue {
    if (this.depth >= this.MAX_DEPTH) {
      throw new ResolutionError('$gen nesting too deep', this.stepTitle)
    }

    this.depth++
    try {
      const { $gen, ...rawOptions } = gen
      // Resolve options first (enables nested $gen or tokens in options)
      const options = this.resolve(rawOptions)
      return GeneratorRegistry.run($gen, options)
    } finally {
      this.depth--
    }
  }
}

/**
 * Phase 1 Resolution: Resolves variables and returns a plain object.
 */
export function resolvePhase1(variables: Variables, store: VariableStore): Variables {
  const resolver = new Resolver(store, 'case variables')
  const resolved: Variables = {}
  for (const [key, value] of Object.entries(variables)) {
    resolved[key] = resolver.resolve(value)
  }
  return resolved
}

/**
 * Phase 2 Resolution: Resolves a Req object in full.
 */
export function resolvePhase2(request: Req, store: VariableStore, stepTitle: string): Req {
  return new Resolver(store, stepTitle).resolve(request)
}

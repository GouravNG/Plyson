import { faker } from '@faker-js/faker'
import { ResolutionError } from '../errors/index.js'
import { GeneratorObject, Req, Scope, Variables, VariableValue } from '../types/index.js'
import { isGenObject } from '../utils/is-gen-object.js'
import { VariableStore } from './variable-store.js'

const TOKEN_RE = /\{\{([^}]+)\}\}/g

/**
 * Finds a faker method by name, potentially qualified with a module name.
 */
function findFakerMethod(methodName: string, moduleHint: string | null = null): Function {
  // 1. Qualified name: "vehicle.type"
  if (methodName.includes('.')) {
    const [mod, fn] = methodName.split('.')
    const fakerMod = (faker as any)[mod]
    if (fakerMod && typeof fakerMod[fn] === 'function') {
      return fakerMod[fn].bind(fakerMod)
    }
    throw new Error(`Faker method not found: ${methodName}`)
  }

  // 2. Module hint: $module: "vehicle"
  if (moduleHint) {
    const fakerMod = (faker as any)[moduleHint]
    if (fakerMod && typeof fakerMod[methodName] === 'function') {
      return fakerMod[methodName].bind(fakerMod)
    }
    throw new Error(`Method "${methodName}" not found in module "${moduleHint}"`)
  }

  // 3. Auto-discover: search all modules
  for (const [_modName, mod] of Object.entries(faker)) {
    if (mod && typeof mod === 'object' && typeof (mod as any)[methodName] === 'function') {
      return (mod as any)[methodName].bind(mod)
    }
  }

  throw new Error(`No faker method found for: "${methodName}"`)
}

export class Resolver {
  private depth = 0
  private readonly MAX_DEPTH = 10

  constructor(
    private store: VariableStore,
    private stepTitle = '',
  ) {}

  /**
   * Walk the value recursively and resolve tokens and generators.
   */
  resolve<T>(input: T): T {
    if (input === null || input === undefined) {
      return input
    }

    // Generator object detection
    if (isGenObject(input)) {
      return this.executeGenerator(input) as T
    }

    // Array support
    if (Array.isArray(input)) {
      return input.map((v) => this.resolve(v)) as unknown as T
    }

    if (typeof input === 'string') {
      return this.resolveString(input) as T
    }

    if (typeof input === 'object') {
      const obj = input as Record<string, any>
      const { $count, ...rest } = obj

      // If $count is present but no $gen, it's an array of objects
      if ($count !== undefined && typeof $count === 'number' && !('$gen' in obj)) {
        return Array.from({ length: $count }, () => this.resolve(rest)) as unknown as T
      }

      // Plain object
      const entries = Object.entries(obj)
      const resolvedEntries = entries.map(([k, v]) => [k, this.resolve(v)])
      return Object.fromEntries(resolvedEntries) as T
    }

    return input
  }

  /**
   * Resolve tokens within a string.
   */
  private resolveString(input: string): VariableValue {
    if (!input.includes('{{')) {
      return input
    }

    const trimmedInput = input.trim()
    const singleTokenMatch = trimmedInput.match(/^\{\{([^}]+)\}\}$/)

    // If it's a single token, return the value directly (could be non-string)
    if (singleTokenMatch) {
      const tokenName = singleTokenMatch[1].trim()
      const value = this.store.get(tokenName)
      if (value === undefined) {
        throw new ResolutionError(`"${tokenName}" in "${input}"`, this.stepTitle)
      }
      return value
    }

    // Otherwise, replace all tokens in the string
    return input.replace(TOKEN_RE, (_, name) => {
      const trimmed = name.trim()
      const value = this.store.get(trimmed)
      if (value === undefined) {
        throw new ResolutionError(`"${trimmed}" in "${input}"`, this.stepTitle)
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
      const { $gen, $count, $module, ...rawOptions } = gen
      const options = this.resolve(rawOptions)

      try {
        const method = findFakerMethod($gen, $module || null)

        const generate = () => {
          // If options is a plain object with keys, pass it to faker.
          // Otherwise, call with no args.
          return Object.keys(options).length > 0 ? method(options) : method()
        }

        if ($count !== undefined && typeof $count === 'number') {
          return Array.from({ length: $count }, generate)
        }

        return generate()
      } catch (err: any) {
        throw new Error(`[$gen: ${$gen}] ${err.message}`)
      }
    } finally {
      this.depth--
    }
  }
}

/**
 * Phase 1 Resolution: Resolves variables and returns a plain object.
 */
export function resolvePhase1(
  variables: Variables,
  store: VariableStore,
  scope?: Scope,
): Variables {
  const resolver = new Resolver(store, 'case variables')
  const resolved: Variables = {}
  for (const [key, value] of Object.entries(variables)) {
    const resolvedValue = resolver.resolve(value)
    resolved[key] = resolvedValue

    // If a scope is provided, update the store immediately so subsequent
    // variables in the same block can reference this one.
    if (scope) {
      store.set(key, resolvedValue, scope)
    }
  }
  return resolved
}

/**
 * Phase 2 Resolution: Resolves a Req object in full.
 */
export function resolvePhase2(request: Req, store: VariableStore, stepTitle: string): Req {
  return new Resolver(store, stepTitle).resolve(request)
}

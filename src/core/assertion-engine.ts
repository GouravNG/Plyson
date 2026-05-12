import { expect, APIResponse } from '@playwright/test'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { Assertions, AssertionOperators, SoftError } from '../types'
import { pathEngine } from '../path'
import { AssertionError, LoadError, SchemaValidationError } from '../errors'

const ajv = new Ajv({ allErrors: true })
addFormats(ajv)

export class AssertionEngine {
  /**
   * Checks the status code against expected value(s).
   */
  static checkStatusCode(actual: number, expected: number | number[]): void {
    const acceptable = Array.isArray(expected) ? expected : [expected]
    if (!acceptable.includes(actual)) {
      throw new AssertionError(
        'status code',
        `Expected ${acceptable.join(' or ')}, received ${actual}`
      )
    }
  }

  /**
   * Validates the body against a JSON schema.
   */
  static async validateSchema(
    body: unknown,
    config: { name: string; validation?: boolean | 'warn' },
    schemas: Map<string, any>,
    softErrors: SoftError[]
  ): Promise<void> {
    const schema = schemas.get(config.name)
    if (!schema) {
      throw new LoadError(`Schema "${config.name}" not found in schemas/`)
    }

    const valid = ajv.validate(schema, body)
    if (!valid) {
      const errors = ajv.errors ?? []
      if (config.validation === 'warn') {
        softErrors.push({ title: `schema:${config.name}`, error: errors })
      } else {
        throw new SchemaValidationError(config.name, errors)
      }
    }
  }

  /**
   * Runs a single assertion.
   */
  static async runAssertion(
    assertion: Assertions,
    body: unknown,
    response: APIResponse,
    softErrors: SoftError[]
  ): Promise<void> {
    const actual =
      assertion.from === 'header'
        ? pathEngine.extractHeader(response, assertion.path)
        : pathEngine.extract(body, assertion.path)

    try {
      this.applyOperator(actual, assertion.operator, assertion.value)
    } catch (err) {
      if (assertion.validation === 'warn') {
        softErrors.push({ title: assertion.title, error: err })
      } else {
        throw new AssertionError(assertion.title, err)
      }
    }
  }

  private static applyOperator(
    actual: unknown,
    operator: AssertionOperators,
    value?: unknown
  ): void {
    const e = expect(actual)

    switch (operator) {
      case 'equals':
        return e.toEqual(value)
      case 'notEquals':
        return e.not.toEqual(value)
      case 'exists':
        return e.toBeDefined()
      case 'notExists':
        return e.toBeUndefined()
      case 'isNull':
        return e.toBeNull()
      case 'isNotNull':
        return e.not.toBeNull()
      case 'isGreaterThan':
        return e.toBeGreaterThan(value as number)
      case 'isLessThan':
        return e.toBeLessThan(value as number)
      case 'isGreaterThanOrEquals':
        return e.toBeGreaterThanOrEqual(value as number)
      case 'isLessThanOrEquals':
        return e.toBeLessThanOrEqual(value as number)
      case 'contains':
        return e.toContain(value)
      case 'notContains':
        return e.not.toContain(value)
      case 'matches':
        return e.toMatch(new RegExp(value as string))
      case 'notMatches':
        return e.not.toMatch(new RegExp(value as string))
      case 'hasLength':
        return e.toHaveLength(value as number)
      case 'hasMinLength':
        return expect((actual as any[]).length).toBeGreaterThanOrEqual(value as number)
      case 'hasMaxLength':
        return expect((actual as any[]).length).toBeLessThanOrEqual(value as number)
      case 'includes':
        return e.toEqual(expect.arrayContaining([value]))
      case 'notIncludes':
        return e.not.toContain(value)
      case 'isEmpty':
        return e.toHaveLength(0)
      case 'isNotEmpty':
        return expect((actual as any[]).length).toBeGreaterThan(0)
      case 'containsSubset':
        return e.toMatchObject(value as any)
      case 'notContainsSubset':
        return e.not.toMatchObject(value as any)
      case 'isString':
        return e.toEqual(expect.any(String))
      case 'isNumber':
        return e.toEqual(expect.any(Number))
      case 'isBoolean':
        return e.toEqual(expect.any(Boolean))
      case 'isArray':
        return e.toEqual(expect.any(Array))
      case 'isObject': {
        expect(actual).not.toBeNull()
        expect(Array.isArray(actual)).toBe(false)
        expect(typeof actual).toBe('object')
        return
      }
      default:
        throw new Error(`Unknown operator "${operator}"`)
    }
  }
}

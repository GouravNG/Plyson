import type { APIResponse, expect as playwrightExpect } from '@playwright/test'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import pc from 'picocolors'
import { AssertionError, LoadError, SchemaValidationError } from '../errors/index.js'
import { pathEngine } from '../path/index.js'
import { AssertionOperators, Assertions, SoftError } from '../types/index.js'
import { Logger } from './logger.js'

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)

let expect: typeof playwrightExpect

export class AssertionEngine {
  static setExpect(instance: typeof playwrightExpect) {
    expect = instance
  }

  /**
   * Registers all schemas into the global AJV instance.
   * Uses [name].schema.json as the $id so relative refs work.
   */
  static registerSchemas(schemas: Map<string, any>) {
    for (const [name, schema] of schemas.entries()) {
      const id = `${name}.schema.json`
      if (!ajv.getSchema(id)) {
        ajv.addSchema({ ...schema, $id: id }, id)
      }
    }
  }

  /**
   * Checks the status code against expected value(s).
   */
  static checkStatusCode(actual: number, expected: number | number[], logger?: Logger): void {
    const acceptable = Array.isArray(expected) ? expected : [expected]
    const passed = acceptable.includes(actual)

    if (logger) {
      this.logAssertionResult(
        logger,
        'Status Code Check',
        acceptable.join(' or '),
        actual,
        'includes',
        passed,
        'status',
      )
    }

    if (!passed) {
      throw new AssertionError(
        'status code',
        `Expected ${acceptable.join(' or ')}, received ${actual}`,
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
    softErrors: SoftError[],
    logger?: Logger,
  ): Promise<void> {
    if (config.validation === false) return

    const schema = schemas.get(config.name)
    if (!schema) {
      throw new LoadError(`Schema "${config.name}" not found in schemas/`)
    }

    const valid = ajv.validate(schema, body)

    if (logger) {
      this.logAssertionResult(
        logger,
        `Schema Validation: ${config.name}`,
        config.name,
        body,
        'matches schema',
        valid,
        'body',
      )
    }

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
    softErrors: SoftError[],
    logger?: Logger,
  ): Promise<void> {
    const actual =
      assertion.from === 'header'
        ? pathEngine.extractHeader(response, assertion.path)
        : pathEngine.extract(body, assertion.path)

    let passed = true
    let error: any = null

    try {
      this.applyOperator(actual, assertion.operator, assertion.value)
    } catch (err) {
      passed = false
      error = err
    }

    if (logger) {
      this.logAssertionResult(
        logger,
        assertion.title,
        assertion.value,
        actual,
        assertion.operator,
        passed,
        assertion.path,
      )
    }

    if (!passed) {
      if (assertion.validation === 'warn') {
        softErrors.push({ title: assertion.title, error })
      } else {
        throw new AssertionError(assertion.title, error)
      }
    }
  }

  private static logAssertionResult(
    logger: Logger,
    title: string,
    expected: any,
    actual: any,
    operator: string,
    passed: boolean,
    path?: string,
  ): void {
    const status = passed ? pc.green('PASS') : pc.red('FAIL')

    const formatValue = (val: any) => {
      if (val === undefined) return pc.dim('undefined')
      const str = JSON.stringify(val)
      return str.length > 200 ? `${str.substring(0, 200)}...` : str
    }

    const displayExpected = expected === undefined ? pc.dim('N/A') : formatValue(expected)
    const displayActual = pc.green(formatValue(actual))

    const logLines = [
      pc.bold('assertion:'),
      `    ${pc.cyan(title)}`,
      `    ${pc.bold('Path:')}     ${pc.cyan(path ?? 'N/A')}`,
      `    ${pc.bold('Expected:')} ${displayExpected} [${pc.yellow(operator)}]`,
      `    ${pc.bold('Actual:')}   ${displayActual}`,
      `    ${pc.bold('Status:')}   ${status}`,
    ]
    logger.info(logLines.join('\n'))
  }

  private static applyOperator(
    actual: unknown,
    operator: AssertionOperators,
    value?: unknown,
  ): void {
    const e = expect(actual)

    switch (operator) {
      case 'equals':
        return e.toEqual(value)
      case 'equalsIgnoreCase':
        return expect(String(actual).toLowerCase()).toEqual(String(value).toLowerCase())
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

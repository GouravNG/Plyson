import { beforeAll, describe, expect, it } from 'vitest'
import { AssertionEngine } from '../core/assertion-engine.js'
import type { APIResponse } from '@playwright/test'
import { AssertionError } from '../errors/index.js'

describe('AssertionEngine', () => {
  beforeAll(() => {
    AssertionEngine.setExpect(expect)
  })

  const mockResponse = {
    headers: () => ({ 'content-type': 'application/json' }),
  } as unknown as APIResponse

  describe('checkStatusCode', () => {
    it('should pass for matching code', () => {
      expect(() => AssertionEngine.checkStatusCode(200, 200)).not.toThrow()
    })
    it('should pass for code in array', () => {
      expect(() => AssertionEngine.checkStatusCode(201, [200, 201])).not.toThrow()
    })
    it('should throw for non-matching code', () => {
      expect(() => AssertionEngine.checkStatusCode(404, [200, 201])).toThrow(AssertionError)
    })
  })

  describe('Operators', () => {
    it('should pass for equals', async () => {
      await AssertionEngine.runAssertion(
        { title: 'eq', from: 'body', path: 'a', operator: 'equals', value: 1 },
        { a: 1 },
        mockResponse,
        []
      )
      await AssertionEngine.runAssertion(
        { title: 'eq obj', from: 'body', path: '$', operator: 'equals', value: { a: 1 } },
        { a: 1 },
        mockResponse,
        []
      )
    })

    it('should throw for not equals', async () => {
      await expect(
        AssertionEngine.runAssertion(
          { title: 'eq fail', from: 'body', path: 'a', operator: 'equals', value: 2 },
          { a: 1 },
          mockResponse,
          []
        )
      ).rejects.toThrow(AssertionError)
    })

    it('should pass for exists/notExists', async () => {
      await AssertionEngine.runAssertion(
        { title: 'ex', from: 'body', path: 'a', operator: 'exists' },
        { a: 1 },
        mockResponse,
        []
      )
      await AssertionEngine.runAssertion(
        { title: 'nex', from: 'body', path: 'b', operator: 'notExists' },
        { a: 1 },
        mockResponse,
        []
      )
    })

    it('should handle numeric comparisons', async () => {
      await AssertionEngine.runAssertion(
        { title: 'gt', from: 'body', path: 'a', operator: 'isGreaterThan', value: 5 },
        { a: 10 },
        mockResponse,
        []
      )
    })

    it('should handle string matching', async () => {
      await AssertionEngine.runAssertion(
        { title: 'match', from: 'body', path: 'a', operator: 'matches', value: '^abc' },
        { a: 'abcdef' },
        mockResponse,
        []
      )
    })

    it('should handle array length', async () => {
      await AssertionEngine.runAssertion(
        { title: 'len', from: 'body', path: 'a', operator: 'hasLength', value: 2 },
        { a: [1, 2] },
        mockResponse,
        []
      )
      await AssertionEngine.runAssertion(
        { title: 'minlen', from: 'body', path: 'a', operator: 'hasMinLength', value: 1 },
        { a: [1, 2] },
        mockResponse,
        []
      )
    })

    it('should handle array inclusion', async () => {
      await AssertionEngine.runAssertion(
        { title: 'inc', from: 'body', path: 'a', operator: 'includes', value: 1 },
        { a: [1, 2] },
        mockResponse,
        []
      )
    })

    it('should handle empty/notEmpty', async () => {
      await AssertionEngine.runAssertion(
        { title: 'empty', from: 'body', path: 'a', operator: 'isEmpty' },
        { a: [] },
        mockResponse,
        []
      )
      await AssertionEngine.runAssertion(
        { title: 'notempty', from: 'body', path: 'a', operator: 'isNotEmpty' },
        { a: [1] },
        mockResponse,
        []
      )
    })

    it('should handle containsSubset', async () => {
      await AssertionEngine.runAssertion(
        { title: 'subset', from: 'body', path: '$', operator: 'containsSubset', value: { a: 1 } },
        { a: 1, b: 2 },
        mockResponse,
        []
      )
    })

    it('should handle type checks', async () => {
      await AssertionEngine.runAssertion(
        { title: 'str', from: 'body', path: 'a', operator: 'isString' },
        { a: 's' },
        mockResponse,
        []
      )
      await AssertionEngine.runAssertion(
        { title: 'num', from: 'body', path: 'a', operator: 'isNumber' },
        { a: 1 },
        mockResponse,
        []
      )
      await AssertionEngine.runAssertion(
        { title: 'bool', from: 'body', path: 'a', operator: 'isBoolean' },
        { a: true },
        mockResponse,
        []
      )
      await AssertionEngine.runAssertion(
        { title: 'arr', from: 'body', path: 'a', operator: 'isArray' },
        { a: [] },
        mockResponse,
        []
      )
      await AssertionEngine.runAssertion(
        { title: 'obj', from: 'body', path: '$', operator: 'isObject' },
        { a: 1 },
        mockResponse,
        []
      )
    })

    it('should throw for isObject with null or array', async () => {
      await expect(
        AssertionEngine.runAssertion(
          { title: 'obj', from: 'body', path: 'a', operator: 'isObject' },
          { a: null },
          mockResponse,
          []
        )
      ).rejects.toThrow()
      await expect(
        AssertionEngine.runAssertion(
          { title: 'obj', from: 'body', path: 'a', operator: 'isObject' },
          { a: [] },
          mockResponse,
          []
        )
      ).rejects.toThrow()
    })
  })

  describe('Soft Errors', () => {
    it('should push to softErrors when validation is warn', async () => {
      const softErrors: any[] = []
      await AssertionEngine.runAssertion(
        {
          title: 'warn me',
          from: 'body',
          path: 'a',
          operator: 'equals',
          value: 2,
          validation: 'warn',
        },
        { a: 1 },
        mockResponse,
        softErrors
      )
      expect(softErrors.length).toBe(1)
      expect(softErrors[0].title).toBe('warn me')
    })

    it('should NOT validate if validation is false (Issue #11)', async () => {
      const schemas = new Map([
        ['User', { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }],
      ])
      const body = { age: 25 }
      const softErrors: any[] = []

      await expect(
        AssertionEngine.validateSchema(body, { name: 'User', validation: false }, schemas, softErrors)
      ).resolves.not.toThrow()
    })

    it('should push schema validation errors to softErrors when validation is warn (Issue #12)', async () => {
      const schemas = new Map([
        ['User', { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }],
      ])
      const body = { age: 25 }
      const softErrors: any[] = []

      await AssertionEngine.validateSchema(
        body,
        { name: 'User', validation: 'warn' },
        schemas,
        softErrors
      )
      expect(softErrors.length).toBe(1)
      expect(softErrors[0].title).toBe('schema:User')
      expect(Array.isArray(softErrors[0].error)).toBe(true)
    })
  })
})

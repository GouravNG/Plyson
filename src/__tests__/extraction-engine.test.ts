import { describe, expect, it } from 'vitest'
import { ExtractionEngine } from '../core/extraction-engine'
import { VariableStore } from '../core/variable-store'
import { APIResponse } from '@playwright/test'
import { ExtractionError } from '../errors'

describe('ExtractionEngine', () => {
  const mockResponse = {
    headers: () => ({ 'token-header': 'header-val' }),
  } as unknown as APIResponse

  it('should extract value from body and save to store', () => {
    const store = new VariableStore()
    const body = { data: { token: 'abc' } }
    ExtractionEngine.runExtraction(
      { name: 'myToken', from: 'body', path: '$.data.token', scope: 'case' },
      body,
      mockResponse,
      store
    )
    expect(store.get('myToken')).toBe('abc')
  })

  it('should extract value from header and save to store', () => {
    const store = new VariableStore()
    ExtractionEngine.runExtraction(
      { name: 'myHeader', from: 'header', path: 'token-header', scope: 'suite' },
      {},
      mockResponse,
      store
    )
    expect(store.get('myHeader')).toBe('header-val')
  })

  it('should throw ExtractionError when path returns undefined', () => {
    const store = new VariableStore()
    expect(() =>
      ExtractionEngine.runExtraction(
        { name: 'fail', from: 'body', path: 'missing', scope: 'case' },
        {},
        mockResponse,
        store
      )
    ).toThrow(ExtractionError)
  })

  it('should write to specified scope', () => {
    const store = new VariableStore()
    ExtractionEngine.runExtraction(
      { name: 'glob', from: 'body', path: 'a', scope: 'global' },
      { a: 1 },
      mockResponse,
      store
    )
    expect(store.snapshot().glob).toBe(1)
    store.pop('global')
    expect(store.get('glob')).toBeUndefined()
  })
})

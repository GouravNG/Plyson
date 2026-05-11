import { describe, expect, it } from 'vitest'
import { pathEngine } from '../path'
import { APIResponse } from '@playwright/test'

describe('PathEngine', () => {
  it('should extract single value using JSONPath', () => {
    const source = { data: { id: 'abc' } }
    expect(pathEngine.extract(source, '$.data.id')).toBe('abc')
  })

  it('should return array for JSONPath filter expressions', () => {
    const source = { items: [{ s: 'active' }, { s: 'disabled' }] }
    const result = pathEngine.extract(source, "$.items[?(@.s=='disabled')]")
    expect(result).toEqual([{ s: 'disabled' }])
  })

  it('should extract wildcard results as array in JSONPath', () => {
    const source = { items: [{ s: 'a' }, { s: 'b' }] }
    expect(pathEngine.extract(source, '$.items[*].s')).toEqual(['a', 'b'])
  })

  it('should extract value using JMESPath', () => {
    const source = { data: { id: 'abc' } }
    expect(pathEngine.extract(source, 'data.id')).toBe('abc')
  })

  it('should handle JMESPath filter expressions', () => {
    const source = { items: [{ s: 'x' }, { s: 'y' }] }
    expect(pathEngine.extract(source, "items[?s=='x']")).toEqual([{ s: 'x' }])
  })

  it('should return undefined for missing paths in JMESPath', () => {
    expect(pathEngine.extract({}, 'does.not.exist')).toBeUndefined()
  })

  it('should extract header case-insensitively', () => {
    const mockResponse = {
      headers: () => ({ 'content-type': 'application/json' })
    } as unknown as APIResponse
    expect(pathEngine.extractHeader(mockResponse, 'Content-Type')).toBe('application/json')
  })
})

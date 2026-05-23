import { describe, expect, it } from 'vitest'
import { VariableStore } from '../../core/variable-store.js'

describe('VariableStore', () => {
  it('should handle scope priority (case > suite > environment > global)', () => {
    const store = new VariableStore()

    store.push('global', { key: 'globalValue' })
    expect(store.get('key')).toBe('globalValue')

    store.push('suite', { key: 'suiteValue' })
    expect(store.get('key')).toBe('suiteValue')

    store.push('case', { key: 'caseValue' })
    expect(store.get('key')).toBe('caseValue')

    store.pop('case')
    expect(store.get('key')).toBe('suiteValue')

    store.pop('suite')
    expect(store.get('key')).toBe('globalValue')
  })

  it('should handle reserved globals', () => {
    const store = new VariableStore()

    const timestamp = store.get('$timestamp')
    expect(typeof timestamp).toBe('number')
    expect(timestamp).toBeLessThanOrEqual(Date.now())
    expect(timestamp).toBeGreaterThan(Date.now() - 1000)

    const isoDate = store.get('$isoDate')
    expect(typeof isoDate).toBe('string')
    expect(new Date(isoDate as string).toISOString()).toBe(isoDate)

    const guid = store.get('$guid')
    expect(typeof guid).toBe('string')
    expect(guid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('should return undefined for unknown names', () => {
    const store = new VariableStore()
    expect(store.get('nonexistent')).toBeUndefined()
  })

  it('should take a snapshot reflecting priority', () => {
    const store = new VariableStore()
    store.push('global', { a: 1, b: 1 })
    store.push('environment', { b: 2, c: 2 })
    store.push('suite', { c: 3, d: 3 })
    store.push('case', { d: 4, e: 4 })

    const snapshot = store.snapshot()
    expect(snapshot).toEqual({
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      e: 4,
    })
  })

  it('should set variables in specific scopes', () => {
    const store = new VariableStore()
    store.set('key', 'value', 'case')
    expect(store.get('key')).toBe('value')

    // Check it's actually in case scope
    store.pop('case')
    expect(store.get('key')).toBeUndefined()
  })
})


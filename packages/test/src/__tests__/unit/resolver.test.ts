import { describe, expect, it } from 'vitest'
import { Resolver, resolvePhase1, resolvePhase2 } from '../../core/resolver.js'
import { VariableStore } from '../../core/variable-store.js'
import { ResolutionError } from '../../errors/index.js'
import { Req } from '../../types/index.js'

describe('Resolver', () => {
  it('should interpolate tokens with type preservation', () => {
    const store = new VariableStore()
    store.push('global', {
      name: 'Alice',
      age: 30,
      active: false,
      meta: { role: 'admin' },
    })

    const resolver = new Resolver(store)

    expect(resolver.resolve('{{name}}')).toBe('Alice')
    expect(resolver.resolve('Hello {{name}}')).toBe('Hello Alice')
    expect(resolver.resolve('{{age}}')).toBe(30)
    expect(resolver.resolve('{{active}}')).toBe(false)
    expect(resolver.resolve('{{meta}}')).toEqual({ role: 'admin' })
    expect(resolver.resolve('User: {{name}}, Age: {{age}}')).toBe('User: Alice, Age: 30')
    expect(resolver.resolve('  {{ name }}  ')).toBe('Alice') // Trimming whitespace
  })

  it('should throw ResolutionError for missing tokens', () => {
    const store = new VariableStore()
    const resolver = new Resolver(store, 'test step')

    expect(() => resolver.resolve('{{missing}}')).toThrow(ResolutionError)
    expect(() => resolver.resolve('{{missing}}')).toThrow(/missing/)
    expect(() => resolver.resolve('{{missing}}')).toThrow(/test step/)
  })

  it('should resolve arrays and objects recursively', () => {
    const store = new VariableStore()
    store.push('global', { a: 'x', b: 'y', c: 1 })

    const resolver = new Resolver(store)

    expect(resolver.resolve(['{{a}}', '{{b}}', '{{c}}'])).toEqual(['x', 'y', 1])
    expect(resolver.resolve({ key: '{{a}}', nested: { val: '{{c}}' } })).toEqual({
      key: 'x',
      nested: { val: 1 },
    })
  })

  it('should execute generators and resolve their options', () => {
    const store = new VariableStore()
    store.push('global', { min: 5, max: 5 })
    const resolver = new Resolver(store)

    const genObj = { $gen: 'int', min: '{{min}}', max: '{{max}}' }
    expect(resolver.resolve(genObj)).toBe(5)
  })

  it('should guard against deeply nested generators', () => {
    const store = new VariableStore()
    const resolver = new Resolver(store)

    // Create a deeply nested generator structure
    let deepGen: any = { $gen: 'fullName' }
    for (let i = 0; i < 11; i++) {
      deepGen = { $gen: 'fullName', options: deepGen }
    }

    expect(() => resolver.resolve(deepGen)).toThrow(ResolutionError)
    expect(() => resolver.resolve(deepGen)).toThrow(/\$gen nesting too deep/)
  })

  it('should resolvePhase1 (variables resolution) with intra-level and multi-token support', () => {
    const store = new VariableStore()
    store.push('global', { base: 'value' })

    const variables = {
      name: 'Alice',
      ref: 'prefix_{{base}}',
      combined: '{{name}} uses {{ref}}',
      scoped: '{{name}} on {{base}}',
    }

    store.push('case', {})
    const resolved = resolvePhase1(variables, store, 'case')

    expect(resolved).toEqual({
      name: 'Alice',
      ref: 'prefix_value',
      combined: 'Alice uses prefix_value',
      scoped: 'Alice on value',
    })

    // Verify store was updated
    expect(store.get('combined')).toBe('Alice uses prefix_value')
  })

  it('should resolve variables across all scope levels sequentially', () => {
    const store = new VariableStore()

    // 1. Global / Project level
    store.push('global', {})
    resolvePhase1({ projectName: 'Plyson', baseUrl: 'https://api.com' }, store, 'global')

    // 2. Environment level (references global)
    store.push('environment', {})
    resolvePhase1({ apiUrl: '{{baseUrl}}/v1', env: 'prod' }, store, 'environment')

    expect(store.get('apiUrl')).toBe('https://api.com/v1')

    // 3. Suite level (references global & environment)
    store.push('suite', {})
    resolvePhase1({ suiteTitle: '{{projectName}} tests on {{env}}' }, store, 'suite')

    expect(store.get('suiteTitle')).toBe('Plyson tests on prod')

    // 4. Case level (references all above + intra-level)
    store.push('case', {})
    resolvePhase1(
      {
        caseUser: 'user_{{env}}',
        caseInfo: '{{suiteTitle}}: {{caseUser}}',
      },
      store,
      'case',
    )

    expect(store.get('caseInfo')).toBe('Plyson tests on prod: user_prod')
  })

  it('should resolvePhase2 (request resolution)', () => {
    const store = new VariableStore()
    store.push('global', { id: 123, host: 'api.example.com' })

    const request: Req = {
      method: 'GET',
      endpoint: '/users/{{id}}',
      headers: {
        Host: '{{host}}',
      },
    }

    const resolved = resolvePhase2(request, store, 'step 1')
    expect(resolved.endpoint).toBe('/users/123')
    expect(resolved.headers?.Host).toBe('api.example.com')
  })
})

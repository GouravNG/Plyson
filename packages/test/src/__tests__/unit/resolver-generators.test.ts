import { describe, expect, it } from 'vitest'
import { resolvePhase1 } from '../../core/resolver.js'
import { VariableStore } from '../../core/variable-store.js'

describe('Resolver + Generators Integration', () => {
  it('should resolve variables containing $gen objects', () => {
    const store = new VariableStore()
    /*
      Equivalent JSON in variables.json or testCase.variables:
      {
        "userEmail": { "$gen": "email", "domain": "test.com" },
        "userId": { "$gen": "uuid" },
        "userAge": { "$gen": "int", "min": 18, "max": 99 }
      }
    */
    const variables = {
      userEmail: { $gen: 'email', provider: 'test.com' },
      userId: { $gen: 'uuid' },
      userAge: { $gen: 'int', min: 18, max: 99 },
    }

    const resolved = resolvePhase1(variables, store)

    expect(resolved.userEmail).toMatch(/@test\.com$/)
    expect(resolved.userId).toMatch(/^[0-9a-f-]{36}$/)
    expect(resolved.userAge).toBeGreaterThanOrEqual(18)
    expect(resolved.userAge).toBeLessThanOrEqual(99)
  })

  it('should handle nested $gen objects', () => {
    const store = new VariableStore()
    /*
      Equivalent JSON:
      {
        "randomString": { 
          "$gen": "alphanumeric", 
          "length": { "$gen": "int", "min": 4, "max": 8 } 
        }
      }
    */
    const variables = {
      // Generate a random length between 4 and 8, then generate a string of that length
      randomString: {
        $gen: 'alphanumeric',
        length: { $gen: 'int', min: 4, max: 8 },
      },
    }

    const resolved = resolvePhase1(variables, store)
    const len = (resolved.randomString as string).length
    expect(len).toBeGreaterThanOrEqual(4)
    expect(len).toBeLessThanOrEqual(8)
  })

  it('should resolve variables in order and support tokens', () => {
    const store = new VariableStore()
    /*
      Equivalent JSON Step 1:
      { "firstName": { "$gen": "firstName" } }
    */
    const initialVars = {
      firstName: { $gen: 'firstName' },
    }
    const resolvedInitial = resolvePhase1(initialVars, store)
    store.push('case', resolvedInitial)

    /*
      Equivalent JSON Step 2:
      { "username": "user_{{firstName}}" }
    */
    const dependentVars = {
      username: 'user_{{firstName}}',
    }
    const resolvedDependent = resolvePhase1(dependentVars, store)

    expect(resolvedDependent.username).toBe(`user_${resolvedInitial.firstName}`)
  })
})


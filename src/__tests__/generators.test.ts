import { describe, expect, it } from 'vitest'
import { Resolver } from '../core/resolver.js'
import { VariableStore } from '../core/variable-store.js'

describe('Faker JSON Schema System', () => {
  const store = new VariableStore()
  const resolver = new Resolver(store)

  describe('Basic Generation', () => {
    it('should generate a full name', () => {
      const res = resolver.resolve({ $gen: 'fullName' }) as string
      expect(typeof res).toBe('string')
      expect(res.length).toBeGreaterThan(0)
    })

    it('should generate an email', () => {
      const res = resolver.resolve({ $gen: 'email' }) as string
      expect(res).toMatch(/^.+@.+\..+$/)
    })

    it('should generate a UUID', () => {
      const res = resolver.resolve({ $gen: 'uuid' }) as string
      expect(res).toMatch(/^[0-9a-f-]{36}$/)
    })
  })

  describe('Parameters', () => {
    it('should pass params to faker methods', () => {
      const res = resolver.resolve({ $gen: 'int', min: 10, max: 10 }) as number
      expect(res).toBe(10)
    })

    it('should handle alpha with length', () => {
      const res = resolver.resolve({ $gen: 'alpha', length: 5 }) as string
      expect(res).toHaveLength(5)
    })
  })

  describe('Nesting and Mixing', () => {
    it('should resolve nested objects', () => {
      const schema = {
        user: {
          name: { $gen: 'fullName' },
          age: { $gen: 'int', min: 18, max: 65 }
        },
        static: 'value'
      }
      const res = resolver.resolve(schema) as any
      expect(typeof res.user.name).toBe('string')
      expect(res.user.age).toBeGreaterThanOrEqual(18)
      expect(res.static).toBe('value')
    })

    it('should resolve nested generators in options', () => {
      const schema = {
        $gen: 'alpha',
        length: { $gen: 'int', min: 4, max: 4 }
      }
      const res = resolver.resolve(schema) as string
      expect(res).toHaveLength(4)
    })
  })

  describe('Array Generation ($count)', () => {
    it('should generate an array of primitives', () => {
      const res = resolver.resolve({ $gen: 'fullName', $count: 3 }) as string[]
      expect(Array.isArray(res)).toBe(true)
      expect(res).toHaveLength(3)
      res.forEach(name => expect(typeof name).toBe('string'))
    })

    it('should generate an array of objects', () => {
      const schema = {
        $count: 2,
        name: { $gen: 'fullName' },
        email: { $gen: 'email' }
      }
      const res = resolver.resolve(schema) as any[]
      expect(res).toHaveLength(2)
      expect(typeof res[0].name).toBe('string')
      expect(typeof res[1].email).toBe('string')
    })
  })

  describe('Disambiguation', () => {
    it('should support fully qualified names', () => {
      const res = resolver.resolve({ $gen: 'vehicle.type' }) as string
      expect(typeof res).toBe('string')
    })

    it('should support $module hint', () => {
      const res = resolver.resolve({ $gen: 'type', $module: 'animal' }) as string
      expect(typeof res).toBe('string')
    })
  })

  describe('Error Handling', () => {
    it('should throw on unknown method', () => {
      expect(() => resolver.resolve({ $gen: 'nonexistentMethod' })).toThrow(/No faker method found/)
    })

    it('should throw on invalid module hint', () => {
      expect(() => resolver.resolve({ $gen: 'fullName', $module: 'invalidMod' })).toThrow(/Method "fullName" not found in module "invalidMod"/)
    })
  })
})

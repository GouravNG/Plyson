import { describe, expect, it, beforeEach } from 'vitest'
import { GeneratorRegistry, registerBuiltins } from '../generators/registry'
import { GeneratorOptionError, UnknownGeneratorError } from '../errors'

describe('Generators', () => {
  beforeEach(() => {
    registerBuiltins()
  })

  describe('StringGenerator', () => {
    it('should generate alphanumeric string', () => {
      const res = GeneratorRegistry.run('string', { length: 10 }) as string
      expect(res).toHaveLength(10)
      expect(typeof res).toBe('string')
    })

    it('should generate numeric string', () => {
      const res = GeneratorRegistry.run('string', { length: 6, numeric: true }) as string
      expect(res).toHaveLength(6)
      expect(res).toMatch(/^\d+$/)
    })

    it('should generate uppercase string', () => {
      const res = GeneratorRegistry.run('string', { length: 4, upper: true }) as string
      expect(res).toMatch(/^[A-Z0-9]+$/)
    })

    it('should throw on invalid length', () => {
      expect(() => GeneratorRegistry.run('string', { length: 0 })).toThrow(GeneratorOptionError)
      expect(() => GeneratorRegistry.run('string', {})).toThrow(GeneratorOptionError)
    })
  })

  describe('NumberGenerator', () => {
    it('should generate integer in range', () => {
      const res = GeneratorRegistry.run('number', { min: 1, max: 10 }) as number
      expect(res).toBeGreaterThanOrEqual(1)
      expect(res).toBeLessThanOrEqual(10)
      expect(Number.isInteger(res)).toBe(true)
    })

    it('should generate float in range', () => {
      const res = GeneratorRegistry.run('number', { min: 1, max: 10, float: true }) as number
      expect(res).toBeGreaterThanOrEqual(1)
      expect(res).toBeLessThanOrEqual(10)
    })

    it('should throw on min > max', () => {
      expect(() => GeneratorRegistry.run('number', { min: 50, max: 10 })).toThrow(GeneratorOptionError)
    })
  })

  describe('BooleanGenerator', () => {
    it('should generate boolean with probability', () => {
      expect(GeneratorRegistry.run('boolean', { probability: 0 })).toBe(false)
      expect(GeneratorRegistry.run('boolean', { probability: 1 })).toBe(true)
    })

    it('should throw on invalid probability', () => {
      expect(() => GeneratorRegistry.run('boolean', { probability: 1.5 })).toThrow(GeneratorOptionError)
    })
  })

  describe('DateGenerators', () => {
    it('should generate current date in different formats', () => {
      const iso = GeneratorRegistry.run('date', { format: 'iso' }) as string
      expect(new Date(iso).toISOString()).toBe(iso)

      const ts = GeneratorRegistry.run('date', { format: 'timestamp' }) as number
      expect(typeof ts).toBe('number')

      const dateOnly = GeneratorRegistry.run('date', { format: 'date' }) as string
      expect(dateOnly).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should generate past date', () => {
      const res = GeneratorRegistry.run('pastDate', { within: '7d' }) as string
      expect(new Date(res).getTime()).toBeLessThan(Date.now() + 10) // Small buffer for execution time
    })

    it('should generate future date', () => {
      const res = GeneratorRegistry.run('futureDate', { within: '1y', format: 'date' }) as string
      expect(res).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(new Date(res).getTime()).toBeGreaterThan(Date.now())
    })

    it('should throw on invalid within', () => {
      expect(() => GeneratorRegistry.run('pastDate', { within: 'bad' })).toThrow(GeneratorOptionError)
    })
  })

  describe('InternetGenerators', () => {
    it('should generate uuid', () => {
      const res = GeneratorRegistry.run('uuid', {}) as string
      expect(res).toMatch(/^[0-9a-f-]{36}$/)
    })

    it('should generate email with domain and prefix', () => {
      const res = GeneratorRegistry.run('email', { domain: 'test.com', prefix: 'qa' }) as string
      expect(res).toMatch(/^qa_.*@test\.com$/)
    })

    it('should generate url and ip', () => {
      expect(typeof GeneratorRegistry.run('url', {})).toBe('string')
      expect(GeneratorRegistry.run('ipAddress', {})).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)
    })
  })

  describe('PersonGenerators', () => {
    it('should generate names', () => {
      expect(typeof GeneratorRegistry.run('fullName', { sex: 'male' })).toBe('string')
      expect(typeof GeneratorRegistry.run('firstName', { sex: 'female' })).toBe('string')
      expect(typeof GeneratorRegistry.run('lastName', {})).toBe('string')
    })
  })

  describe('PhoneGenerator', () => {
    it('should generate phone number', () => {
      const res = GeneratorRegistry.run('phoneNumber', { style: 'international' }) as string
      // International usually starts with +
      expect(res).toMatch(/^\+?/)
    })
  })

  it('should throw UnknownGeneratorError', () => {
    expect(() => GeneratorRegistry.run('nonexistent', {})).toThrow(UnknownGeneratorError)
  })
})

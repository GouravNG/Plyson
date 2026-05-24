import { describe, expect, it } from 'vitest'
import { generateFromSchema } from '../../autofill/schema-generator.js'
import { AssertionEngine } from '../../core/assertion-engine.js'

describe('Schema Reference Handling', () => {
  describe('SchemaGenerator (AutoFill)', () => {
    it('should follow $ref in properties', () => {
      const schemas = new Map([
        ['User', { type: 'object', properties: { id: { type: 'string', example: 'user-1' } } }],
      ])

      const schemaWithRef = {
        type: 'object',
        properties: {
          user: { $ref: 'User.schema.json' },
        },
      }

      const generated = generateFromSchema(schemaWithRef, {}, schemas)
      expect(generated).toEqual({
        user: { id: 'user-1' },
      })
    })

    it('should follow top-level $ref', () => {
      const schemas = new Map([
        ['User', { type: 'object', properties: { id: { type: 'string', example: 'user-1' } } }],
      ])

      const schemaWithRef = { $ref: 'User.schema.json' }

      const generated = generateFromSchema(schemaWithRef, {}, schemas)
      expect(generated).toEqual({
        id: 'user-1',
      })
    })

    it('should handle recursion gracefully', () => {
      const schemas = new Map([
        ['User', { type: 'object', properties: { friend: { $ref: 'User.schema.json' } } }],
      ])

      const schema = { $ref: 'User.schema.json' }

      const generated = generateFromSchema(schema, {}, schemas)
      // It should stop at depth limit and return null for the deep ref
      expect(generated.friend).toBeDefined()
    })
  })

  describe('AssertionEngine (AJV)', () => {
    it('should validate against schemas with relative refs', async () => {
      const schemas = new Map([
        ['User', { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }],
        [
          'Profile',
          {
            type: 'object',
            properties: { user: { $ref: 'User.schema.json' } },
            required: ['user'],
          },
        ],
      ])

      AssertionEngine.registerSchemas(schemas)

      const validBody = { user: { id: '123' } }
      const invalidBody = { user: { not_id: '123' } }
      const softErrors: any[] = []

      // Valid
      await expect(
        AssertionEngine.validateSchema(validBody, { name: 'Profile' }, schemas, softErrors),
      ).resolves.not.toThrow()

      // Invalid
      await expect(
        AssertionEngine.validateSchema(invalidBody, { name: 'Profile' }, schemas, softErrors),
      ).rejects.toThrow()
    })

    it('should ignore unknown keywords like "example" in schemas', async () => {
      const schemas = new Map([
        [
          'User',
          {
            type: 'object',
            properties: { id: { type: 'string', example: '123' } },
            example: { id: '123' },
          },
        ],
      ])

      AssertionEngine.registerSchemas(schemas)

      const body = { id: '123' }
      const softErrors: any[] = []

      await expect(
        AssertionEngine.validateSchema(body, { name: 'User' }, schemas, softErrors),
      ).resolves.not.toThrow()
    })
  })
})

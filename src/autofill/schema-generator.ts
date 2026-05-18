import { faker } from '@faker-js/faker'
import { AutoFillFields } from '../types/index.js'
import { applyFieldFilter } from './field-filter.js'

/**
 * Generates a payload object from a JSON schema, respecting field filters.
 */
export function generateFromSchema(
  schema: any,
  filterConfig: AutoFillFields,
  allSchemas: Map<string, any> = new Map(),
  depth = 0
): Record<string, unknown> {
  // If the root schema is a ref, resolve it first
  let targetSchema = schema
  if (schema.$ref) {
    const name = schema.$ref.replace('.schema.json', '')
    targetSchema = allSchemas.get(name) || schema
  }

  const properties = targetSchema.properties ?? {}
  const allFields = Object.keys(properties)
  const activeFields = applyFieldFilter(allFields, filterConfig)

  return Object.fromEntries(
    activeFields.map((field) => [
      field,
      generateValueForField(properties[field], allSchemas, depth),
    ])
  )
}

function generateValueForField(
  schema: any,
  allSchemas: Map<string, any>,
  depth = 0
): unknown {
  if (!schema) return null
  if (depth > 10) return null // Recursion guard

  // Handle $ref
  if (schema.$ref) {
    const name = schema.$ref.replace('.schema.json', '')
    const target = allSchemas.get(name)
    if (target) {
      return generateValueForField(target, allSchemas, depth + 1)
    }
    return null
  }

  if (schema.example !== undefined) return schema.example
  if (schema.enum?.length) return schema.enum[0]

  switch (schema.type) {
    case 'string':
      return generateString(schema)
    case 'number':
    case 'integer':
      return generateNumber(schema)
    case 'boolean':
      return false
    case 'array':
      return []
    case 'object':
      return schema.properties ? generateFromSchema(schema, {}, allSchemas, depth + 1) : {}
    default:
      return null
  }
}

function generateString(schema: any): string {
  if (schema.format === 'email') return faker.internet.email()
  if (schema.format === 'uuid') return faker.string.uuid()
  if (schema.format === 'date') return new Date().toISOString().split('T')[0]
  if (schema.format === 'date-time') return new Date().toISOString()
  if (schema.format === 'uri') return faker.internet.url()

  const length = schema.minLength ?? schema.maxLength ?? 8
  return faker.string.alphanumeric({ length })
}

function generateNumber(schema: any): number {
  const min = schema.minimum ?? 0
  const max = schema.maximum ?? 100
  return schema.type === 'integer'
    ? faker.number.int({ min, max })
    : faker.number.float({ min, max, fractionDigits: 2 })
}

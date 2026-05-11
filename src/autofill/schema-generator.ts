import { faker } from '@faker-js/faker'
import { AutoFillFields } from '../types'
import { applyFieldFilter } from './field-filter'

/**
 * Generates a payload object from a JSON schema, respecting field filters.
 */
export function generateFromSchema(
  schema: any,
  filterConfig: AutoFillFields
): Record<string, unknown> {
  const properties = schema.properties ?? {}
  const allFields = Object.keys(properties)
  const activeFields = applyFieldFilter(allFields, filterConfig)

  return Object.fromEntries(
    activeFields.map((field) => [field, generateValueForField(properties[field])])
  )
}

function generateValueForField(schema: any): unknown {
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
      return schema.properties ? generateFromSchema(schema, {}) : {}
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

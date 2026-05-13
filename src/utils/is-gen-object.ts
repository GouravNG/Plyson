import { GeneratorObject } from '../types/index.js'

/**
 * Type guard to check if a value is a GeneratorObject.
 */
export function isGenObject(value: unknown): value is GeneratorObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    '$gen' in value &&
    typeof (value as any).$gen === 'string'
  )
}

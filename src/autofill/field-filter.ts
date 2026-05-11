import { AutoFillFields } from '../types'

/**
 * Applies includeFields or excludeFields filtering to a list of fields.
 */
export function applyFieldFilter(allFields: string[], config: AutoFillFields): string[] {
  if ('includeFields' in config && config.includeFields.length > 0) {
    return config.includeFields.filter((f) => allFields.includes(f))
  }

  if ('excludeFields' in config && config.excludeFields.length > 0) {
    return allFields.filter((f) => !config.excludeFields.includes(f))
  }

  return allFields
}

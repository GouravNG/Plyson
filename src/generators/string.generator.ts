import { faker } from '@faker-js/faker'
import { GeneratorOptionError } from '../errors/index.js'
import { Generator } from './registry.js'

export interface StringOptions {
  length: number
  numeric?: boolean
  upper?: boolean
  lower?: boolean
}

export class StringGenerator implements Generator<StringOptions> {
  run(options: StringOptions): string {
    const { length, numeric, upper, lower } = options

    if (typeof length !== 'number' || length < 1) {
      throw new GeneratorOptionError('string', 'length must be a positive number')
    }

    if (numeric) {
      return faker.string.numeric({ length, allowLeadingZeros: true })
    }

    const casing: 'upper' | 'lower' | 'mixed' = upper ? 'upper' : lower ? 'lower' : 'mixed'

    return faker.string.alphanumeric({ length, casing })
  }
}

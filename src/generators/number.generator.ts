import { faker } from '@faker-js/faker'
import { GeneratorOptionError } from '../errors/index.js'
import { Generator } from './registry.js'

export interface NumberOptions {
  min?: number
  max?: number
  float?: boolean
  precision?: number
}

export class NumberGenerator implements Generator<NumberOptions> {
  run(options: NumberOptions): number {
    const { min = 0, max = 1_000_000, float = false, precision = 2 } = options

    if (typeof min !== 'number' || typeof max !== 'number' || min > max) {
      throw new GeneratorOptionError(
        'number',
        `min (${min}) must be less than or equal to max (${max})`
      )
    }

    if (float) {
      return faker.number.float({ min, max, fractionDigits: precision })
    }

    return faker.number.int({ min, max })
  }
}

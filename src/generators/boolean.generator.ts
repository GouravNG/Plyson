import { faker } from '@faker-js/faker'
import { GeneratorOptionError } from '../errors'
import { Generator } from './registry'

export interface BooleanOptions {
  probability?: number
}

export class BooleanGenerator implements Generator<BooleanOptions> {
  run(options: BooleanOptions): boolean {
    const { probability = 0.5 } = options

    if (typeof probability !== 'number' || probability < 0 || probability > 1) {
      throw new GeneratorOptionError('boolean', 'probability must be between 0 and 1')
    }

    return faker.datatype.boolean({ probability })
  }
}

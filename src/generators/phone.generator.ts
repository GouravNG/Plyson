import { faker } from '@faker-js/faker'
import { Generator } from './registry.js'

export interface PhoneOptions {
  style?: 'international' | 'national'
}

export class PhoneNumberGenerator implements Generator<PhoneOptions> {
  run({ style = 'national' }: PhoneOptions): string {
    return faker.phone.number({ style })
  }
}

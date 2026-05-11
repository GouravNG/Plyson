import { faker } from '@faker-js/faker'
import { Generator } from './registry'
import { VariableValue } from '../types'

export class UuidGenerator implements Generator {
  run(): string {
    return faker.string.uuid()
  }
}

export interface EmailOptions {
  domain?: string
  prefix?: string
}

export class EmailGenerator implements Generator<EmailOptions> {
  run({ domain, prefix }: EmailOptions): string {
    const email = faker.internet.email({ provider: domain })
    if (prefix) {
      const [, host] = email.split('@')
      // faker.string.alphanumeric(6) as per prompt
      return `${prefix}_${faker.string.alphanumeric(6)}@${host}`
    }
    return email
  }
}

export class UrlGenerator implements Generator {
  run(): string {
    return faker.internet.url()
  }
}

export class IpAddressGenerator implements Generator {
  run(): string {
    return faker.internet.ipv4()
  }
}

import { UnknownGeneratorError } from '../errors'
import { VariableValue } from '../types'
import { BooleanGenerator } from './boolean.generator'
import { DateGenerator, FutureDateGenerator, PastDateGenerator } from './date.generator'
import {
  EmailGenerator,
  IpAddressGenerator,
  UuidGenerator,
  UrlGenerator,
} from './internet.generator'
import { NumberGenerator } from './number.generator'
import { FirstNameGenerator, FullNameGenerator, LastNameGenerator } from './person.generator'
import { PhoneNumberGenerator } from './phone.generator'
import { StringGenerator } from './string.generator'

export interface Generator<O extends object = Record<string, unknown>> {
  run(options: O): VariableValue
}

export class GeneratorRegistry {
  private static generators = new Map<string, Generator<any>>()

  static register(name: string, generator: Generator<any>): void {
    this.generators.set(name, generator)
  }

  static run(name: string, options: Record<string, unknown>): VariableValue {
    const gen = this.generators.get(name)
    if (!gen) {
      throw new UnknownGeneratorError(name)
    }
    return gen.run(options)
  }

  static has(name: string): boolean {
    return this.generators.has(name)
  }
}

export function registerBuiltins(): void {
  GeneratorRegistry.register('string', new StringGenerator())
  GeneratorRegistry.register('number', new NumberGenerator())
  GeneratorRegistry.register('boolean', new BooleanGenerator())
  GeneratorRegistry.register('date', new DateGenerator())
  GeneratorRegistry.register('pastDate', new PastDateGenerator())
  GeneratorRegistry.register('futureDate', new FutureDateGenerator())
  GeneratorRegistry.register('uuid', new UuidGenerator())
  GeneratorRegistry.register('email', new EmailGenerator())
  GeneratorRegistry.register('fullName', new FullNameGenerator())
  GeneratorRegistry.register('firstName', new FirstNameGenerator())
  GeneratorRegistry.register('lastName', new LastNameGenerator())
  GeneratorRegistry.register('phoneNumber', new PhoneNumberGenerator())
  GeneratorRegistry.register('url', new UrlGenerator())
  GeneratorRegistry.register('ipAddress', new IpAddressGenerator())
}

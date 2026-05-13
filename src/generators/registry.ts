import { UnknownGeneratorError } from '../errors/index.js'
import { VariableValue } from '../types/index.js'
import { BooleanGenerator } from './boolean.generator.js'
import { DateGenerator, FutureDateGenerator, PastDateGenerator } from './date.generator.js'
import {
  EmailGenerator,
  IpAddressGenerator,
  UuidGenerator,
  UrlGenerator,
} from './internet.generator.js'
import { NumberGenerator } from './number.generator.js'
import { FirstNameGenerator, FullNameGenerator, LastNameGenerator } from './person.generator.js'
import { PhoneNumberGenerator } from './phone.generator.js'
import { StringGenerator } from './string.generator.js'

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

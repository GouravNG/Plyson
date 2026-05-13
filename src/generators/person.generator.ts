import { faker } from '@faker-js/faker'
import { Generator } from './registry.js'

export interface PersonOptions {
  sex?: 'male' | 'female'
}

export class FullNameGenerator implements Generator<PersonOptions> {
  run({ sex }: PersonOptions): string {
    return faker.person.fullName({ sex })
  }
}

export class FirstNameGenerator implements Generator<PersonOptions> {
  run({ sex }: PersonOptions): string {
    return faker.person.firstName(sex)
  }
}

export class LastNameGenerator implements Generator {
  run(): string {
    return faker.person.lastName()
  }
}

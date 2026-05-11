export interface StringGeneratorOptions {
  length: number
  numeric?: boolean
  upper?: boolean
  lower?: boolean
}

export interface NumberGeneratorOptions {
  min?: number
  max?: number
  float?: boolean
  precision?: number
}

export interface BooleanGeneratorOptions {
  probability?: number
}

export interface DateGeneratorOptions {
  format?: 'iso' | 'timestamp' | 'date'
}

export interface PastDateGeneratorOptions extends DateGeneratorOptions {
  within?: string
}

export interface FutureDateGeneratorOptions extends DateGeneratorOptions {
  within?: string
}

export interface EmailGeneratorOptions {
  domain?: string
  prefix?: string
}

export interface FullNameGeneratorOptions {
  sex?: 'male' | 'female'
}

export interface FirstNameGeneratorOptions {
  sex?: 'male' | 'female'
}

export interface PhoneNumberGeneratorOptions {
  style?: 'international' | 'national'
}

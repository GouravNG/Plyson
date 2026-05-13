import { faker } from '@faker-js/faker'
import { GeneratorOptionError } from '../errors/index.js'
import { Generator } from './registry.js'

export interface DateOptions {
  within?: string
  format?: 'iso' | 'timestamp' | 'date'
}

export function parseWithin(within: string): { years?: number; months?: number; days?: number } {
  const match = within.match(/^(\d+)(d|M|y)$/)
  if (!match) {
    throw new GeneratorOptionError(
      'date',
      `Invalid "within": "${within}". Use e.g. "7d", "3M", "1y"`
    )
  }
  const n = parseInt(match[1])
  const unit = match[2]
  return unit === 'd' ? { days: n } : unit === 'M' ? { months: n } : { years: n }
}

export function formatDate(date: Date, format: DateOptions['format'] = 'iso'): string | number {
  if (format === 'timestamp') return date.getTime()
  if (format === 'date') return date.toISOString().split('T')[0]
  return date.toISOString()
}

export class DateGenerator implements Generator<DateOptions> {
  run({ format }: DateOptions): string | number {
    return formatDate(new Date(), format)
  }
}

export class PastDateGenerator implements Generator<DateOptions> {
  run({ within = '30d', format }: DateOptions): string | number {
    return formatDate(faker.date.past({ ...parseWithin(within), refDate: new Date() }), format)
  }
}

export class FutureDateGenerator implements Generator<DateOptions> {
  run({ within = '30d', format }: DateOptions): string | number {
    return formatDate(faker.date.future({ ...parseWithin(within), refDate: new Date() }), format)
  }
}

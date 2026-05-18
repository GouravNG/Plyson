import pc from 'picocolors'

export type LogLevel = 'info' | 'warn' | 'error' | 'off'

export interface Logger {
  info(message: string): void
  warn(title: string, message: any): void
  error(message: any): void
}

const LOG_LEVELS: Record<LogLevel, number> = {
  info: 0,
  warn: 1,
  error: 2,
  off: 3,
}

export class ConsoleLogger implements Logger {
  private level: number
  private id: string

  constructor(id: string) {
    this.id = id
    const envLevel = (process.env.PLAYSON_LOG_LEVEL?.toLowerCase() as LogLevel) || 'info'
    this.level = LOG_LEVELS[envLevel] ?? LOG_LEVELS.info
  }

  info(message: string): void {
    if (this.level <= LOG_LEVELS.info) {
      console.log(`${pc.cyan('INFO')}  [${this.id}] -> ${message}`)
    }
  }

  warn(title: string, message: any): void {
    if (this.level <= LOG_LEVELS.warn) {
      const formatted = this.formatError(message)
      console.warn(`${pc.yellow('WARN')}  [${this.id}] -> ${title}: ${formatted}`)
    }
  }

  error(message: any): void {
    if (this.level <= LOG_LEVELS.error) {
      const formatted = this.formatError(message)
      console.error(`${pc.red('ERROR')} [${this.id}] -> ${formatted}`)
    }
  }

  private formatError(err: any): string {
    if (err instanceof Error) {
      return err.stack || err.message
    }
    if (typeof err === 'object') {
      try {
        return JSON.stringify(err, null, 2)
      } catch {
        return String(err)
      }
    }
    return String(err)
  }
}

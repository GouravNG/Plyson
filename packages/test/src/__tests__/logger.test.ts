import pc from 'picocolors'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConsoleLogger } from '../core/logger'

describe('ConsoleLogger', () => {
  let logSpy: any
  let warnSpy: any
  let errorSpy: any

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.PLAYSON_LOG_LEVEL
  })

  it('logs info when level is info', () => {
    process.env.PLAYSON_LOG_LEVEL = 'info'
    const logger = new ConsoleLogger('test-id')
    logger.info('hello')
    expect(logSpy).toHaveBeenCalledWith(`${pc.cyan('INFO')}  [test-id] -> hello`)
  })

  it('does not log info when level is warn', () => {
    process.env.PLAYSON_LOG_LEVEL = 'warn'
    const logger = new ConsoleLogger('test-id')
    logger.info('hello')
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('logs warn when level is warn', () => {
    process.env.PLAYSON_LOG_LEVEL = 'warn'
    const logger = new ConsoleLogger('test-id')
    logger.warn('Title', 'message')
    expect(warnSpy).toHaveBeenCalledWith(`${pc.yellow('WARN')}  [test-id] -> Title: message`)
  })

  it('logs error when level is error', () => {
    process.env.PLAYSON_LOG_LEVEL = 'error'
    const logger = new ConsoleLogger('test-id')
    logger.error('error message')
    expect(errorSpy).toHaveBeenCalledWith(`${pc.red('ERROR')} [test-id] -> error message`)
  })

  it('formats objects in logs', () => {
    const logger = new ConsoleLogger('test-id')
    logger.error({ foo: 'bar' })
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('"foo": "bar"'))
  })

  it('formats errors with stacks', () => {
    const logger = new ConsoleLogger('test-id')
    const err = new Error('boom')
    logger.error(err)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error: boom'))
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('at '))
  })
})

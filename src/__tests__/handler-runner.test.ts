import { describe, expect, it, vi } from 'vitest'
import { HandlerRunner, HandlerContext } from '../core/handler-runner'
import { HandlerModule } from '../types'
import { LoadError } from '../errors'

describe('HandlerRunner', () => {
  it('should execute handlers in order', async () => {
    const log: string[] = []
    const h1: HandlerModule = {
      run: async () => {
        log.push('h1')
      },
    }
    const h2: HandlerModule = {
      run: async () => {
        log.push('h2')
      },
    }

    const handlers = new Map<string, HandlerModule>([
      ['h1', h1],
      ['h2', h2],
    ])

    const ctx = {} as HandlerContext
    await HandlerRunner.runHandlers(['h1', 'h2'], ctx, handlers)

    expect(log).toEqual(['h1', 'h2'])
  })

  it('should throw LoadError if handler is missing', async () => {
    const handlers = new Map<string, HandlerModule>()
    const ctx = {} as HandlerContext
    await expect(HandlerRunner.runHandlers(['missing'], ctx, handlers)).rejects.toThrow(LoadError)
  })

  it('should stop execution if a handler throws', async () => {
    const log: string[] = []
    const h1: HandlerModule = {
      run: async () => {
        throw new Error('fail')
      },
    }
    const h2: HandlerModule = {
      run: async () => {
        log.push('h2')
      },
    }

    const handlers = new Map<string, HandlerModule>([
      ['h1', h1],
      ['h2', h2],
    ])

    const ctx = {} as HandlerContext
    await expect(HandlerRunner.runHandlers(['h1', 'h2'], ctx, handlers)).rejects.toThrow('fail')
    expect(log).toEqual([])
  })
})

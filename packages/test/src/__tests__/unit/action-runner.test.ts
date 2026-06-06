import { describe, expect, it, vi } from 'vitest'
import { ActionRunner } from '../../core/action-runner.js'
import { VariableStore } from '../../core/variable-store.js'
import { ConsoleLogger } from '../../core/logger.js'

describe('ActionRunner', () => {
  it('should execute a valid action with context', async () => {
    const store = new VariableStore()
    const logger = new ConsoleLogger('test')
    const mockRequest = {} as any
    
    const actionFn = vi.fn(async ({ args, log, store: ctxStore }) => {
      log(`Hello ${args.name}`)
      ctxStore.set('result', 'done', 'case')
    })

    const actions = new Map([
      ['hello', { default: actionFn }]
    ])

    const runner = new ActionRunner(mockRequest, store, actions as any, logger)
    
    await runner.runAction({
      title: 'Run Hello',
      action: 'hello',
      args: { name: 'World' }
    })

    expect(actionFn).toHaveBeenCalledOnce()
    expect(store.get('result')).toBe('done')
  })

  it('should resolve variables in arguments before calling action', async () => {
    const store = new VariableStore()
    store.push('global', { username: 'Gourav' })
    
    const logger = new ConsoleLogger('test')
    const mockRequest = {} as any
    
    const actionFn = vi.fn(async ({ args }) => {
      return args.user
    })

    const actions = new Map([
      ['greet', { default: actionFn }]
    ])

    const runner = new ActionRunner(mockRequest, store, actions as any, logger)
    
    await runner.runAction({
      title: 'Run Greet',
      action: 'greet',
      args: { user: '{{username}}' }
    })

    expect(actionFn).toHaveBeenCalledWith(expect.objectContaining({
      args: { user: 'Gourav' }
    }))
  })

  it('should throw error if action is not found', async () => {
    const runner = new ActionRunner({} as any, new VariableStore(), new Map(), new ConsoleLogger('test'))
    await expect(runner.runAction({ title: 'Fail', action: 'missing' })).rejects.toThrow('Action "missing" not found')
  })

  it('should throw error if action has no default export', async () => {
    const actions = new Map([
      ['invalid', {}]
    ])
    const runner = new ActionRunner({} as any, new VariableStore(), actions as any, new ConsoleLogger('test'))
    await expect(runner.runAction({ title: 'Fail', action: 'invalid' })).rejects.toThrow('must have a default export function')
  })
})

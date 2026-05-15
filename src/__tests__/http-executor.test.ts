import { describe, expect, it, vi } from 'vitest'
import { HttpExecutor } from '../core/http-executor.js'
import type { APIRequestContext, APIResponse } from '@playwright/test'
import type { ResolvedStep } from '../types/index.js'

describe('HttpExecutor', () => {
  const mockContext = {
    fetch: vi.fn().mockResolvedValue({
      status: () => 200,
      json: async () => ({ success: true }),
      headers: () => ({ 'content-type': 'application/json' }),
    } as unknown as APIResponse),
  } as unknown as APIRequestContext

  const schemas = new Map([
    [
      'user',
      {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Fixed Name' },
          role: { type: 'string', example: 'user' },
        },
      },
    ],
  ])

  const executor = new HttpExecutor(mockContext, 'https://api.com', schemas)

  it('should apply path parameters correctly', async () => {
    const step: ResolvedStep = {
      title: 'Get User',
      request: {
        method: 'GET',
        endpoint: '/users/:id',
        pathParams: { id: 42 },
        headers: {},
        queryParams: {},
      },
      response: { validations: { statusCode: 200 } },
    }

    await executor.execute(step)
    expect(mockContext.fetch).toHaveBeenCalledWith(
      'https://api.com/users/42',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('should apply skip_auth flag correctly', async () => {
    const step: ResolvedStep = {
      title: 'Public Call',
      flags: ['skip_auth'],
      request: {
        method: 'GET',
        endpoint: '/public',
        headers: { Authorization: 'Bearer secret' },
        queryParams: {},
      },
      response: { validations: { statusCode: 200 } },
    }

    await executor.execute(step)
    const callArgs = vi.mocked(mockContext.fetch).mock.calls[1][1]
    expect(callArgs?.headers).not.toHaveProperty('Authorization')
  })

  it('should handle autoFill correctly', async () => {
    const step: ResolvedStep = {
      title: 'Create User',
      request: {
        method: 'POST',
        endpoint: '/users',
        autoFill: { schemaName: 'user' },
        payload: { role: 'admin' }, // Override role
        headers: {},
        queryParams: {},
      },
      response: { validations: { statusCode: 201 } },
    }

    await executor.execute(step)
    const callArgs = vi.mocked(mockContext.fetch).mock.calls[2][1]
    expect(callArgs?.data).toEqual({
      name: 'Fixed Name',
      role: 'admin',
    })
  })
})

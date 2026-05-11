import { describe, it, expect } from 'vitest'
import { TestSuiteSchema, AssertionSchema, AssertionOperatorsSchema } from '../types'

describe('Phase 1: Zod Schema Validation', () => {
  it('should parse a valid TestSuite fixture without errors', () => {
    const validTestSuite = {
      title: 'Sample Suite',
      tags: ['smoke'],
      testCases: [
        {
          id: 'case-1',
          title: 'Sample Case',
          tags: ['p0'],
          steps: [
            {
              title: 'Step 1',
              request: {
                method: 'GET',
                endpoint: '/users',
              },
              response: {
                validations: {
                  statusCode: 200,
                },
              },
            },
          ],
        },
      ],
    }

    const result = TestSuiteSchema.safeParse(validTestSuite)
    expect(result.success).toBe(true)
  })

  it('should parse a valid Assertions fixture with all operator variants', () => {
    const operators = AssertionOperatorsSchema.options

    operators.forEach((operator) => {
      const assertion = {
        title: `Test ${operator}`,
        from: 'body',
        path: '$.data',
        operator: operator,
        value: 'some-value',
      }

      const result = AssertionSchema.safeParse(assertion)
      if (!result.success) {
        console.error(`Failed operator: ${operator}`, result.error)
      }
      expect(result.success).toBe(true)
    })
  })

  it('should reject a TestSuite missing required fields', () => {
    const invalidTestSuite = {
      title: 'Missing Tags and TestCases',
    }

    const result = TestSuiteSchema.safeParse(invalidTestSuite)
    expect(result.success).toBe(false)
  })

  it('should reject an Assertions object with an invalid operator string', () => {
    const invalidAssertion = {
      title: 'Invalid Operator',
      from: 'body',
      path: '$.data',
      operator: 'invalid-op',
    }

    const result = AssertionSchema.safeParse(invalidAssertion)
    expect(result.success).toBe(false)
  })

  it("should apply the default value 'error' to validation field when omitted", () => {
    const assertion = {
      title: 'Default Validation',
      from: 'body',
      path: '$.data',
      operator: 'equals',
      value: 'test',
    }

    const result = AssertionSchema.safeParse(assertion)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.validation).toBe('error')
    }
  })
})

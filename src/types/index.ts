import { z } from 'zod'
import { HandlerContext } from '../core/handler-runner'
import { ResolvedRequest } from '../core/http-executor'

// =========================================================================================================
// Foundation types
// =========================================================================================================

export type Variables = Record<string, any>
export type Scope = 'global' | 'environment' | 'suite' | 'case'
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export type GeneratorObject = {
  $gen: string
  [key: string]: any
}

export type VariableValue =
  | string
  | number
  | boolean
  | null
  | any[]
  | Record<string, any>
  | GeneratorObject

export type AutoFillFields =
  | { includeFields: string[] }
  | { excludeFields: string[] }
  | Record<string, never>
export type AutoFillType = false | ({ schemaName: string } & AutoFillFields)

export type AssertionOperators =
  | 'equals'
  | 'notEquals'
  | 'exists'
  | 'notExists'
  | 'isNull'
  | 'isNotNull'
  | 'isGreaterThan'
  | 'isLessThan'
  | 'isGreaterThanOrEquals'
  | 'isLessThanOrEquals'
  | 'contains'
  | 'notContains'
  | 'matches'
  | 'notMatches'
  | 'hasLength'
  | 'hasMinLength'
  | 'hasMaxLength'
  | 'includes'
  | 'notIncludes'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'containsSubset'
  | 'notContainsSubset'
  | 'isString'
  | 'isNumber'
  | 'isBoolean'
  | 'isArray'
  | 'isObject'

export type Assertions = {
  title: string
  from: 'body' | 'header'
  path: string
  operator: AssertionOperators
  value?: any
  validation?: 'warn' | 'error'
}

export type ExtractedValue = {
  name: string
  from: 'body' | 'header'
  path: string
  scope: Scope
}

export type Req = {
  method: HTTPMethod
  endpoint: string
  queryParams?: Record<string, any>
  pathParams?: Record<string, any>
  headers?: Record<string, any>
  autoFill?: AutoFillType
  payload?: Record<string, any>
}

export type Res = {
  schema?: {
    name: string
    validation?: boolean | 'warn'
  }
  validations: {
    statusCode: number | number[]
    assertions?: Assertions[]
  }
  extract?: ExtractedValue[]
}

export type CommonTestStep = {
  title: string
  description?: string
  disabled?: boolean
  wait?: number
  flags?: string[]
  handlers?: string[]
  request: Req
  response: Res
}

export type ReferencedTestStep = {
  ref: string
  description?: string
}

export type InlineTestStep = CommonTestStep & { ref?: never }

export type TestStep = ReferencedTestStep | InlineTestStep

export type Testcase = {
  id: string
  title: string
  description?: string
  disabled?: boolean
  testType?: 'positive' | 'negative'
  variables?: Variables
  tags: string[]
  steps: TestStep[]
}

export type TestSuite = {
  title: string
  description?: string
  disabled?: boolean
  tags: string[]
  variables?: Variables
  beforeAll?: TestStep[]
  afterAll?: TestStep[]
  testCases: Testcase[]
}

export type Project = {
  title: string
  description?: string
  version: string
  beforeAll?: TestStep[]
  afterAll?: TestStep[]
  defaultEnv?: string
}

export type EnvironmentVariables = {
  baseUrl: string
  specUrl?: string
  variables?: Variables
}

export type SoftError = {
  title: string
  error: unknown
}

export type HandlerModule = {
  run: (ctx: HandlerContext) => Promise<void>
}

export type ResolvedStep = Omit<CommonTestStep, 'request'> & {
  request: ResolvedRequest
}

// =========================================================================================================
// ZOD SCHEMAS
// =========================================================================================================

export const VariablesSchema = z.record(z.any())

export const GeneratorObjectSchema = z
  .object({
    $gen: z.string(),
  })
  .catchall(z.any())

export const AutoFillFieldsSchema = z.union([
  z.object({ includeFields: z.array(z.string()) }),
  z.object({ excludeFields: z.array(z.string()) }),
  z.object({}).strict(),
])

export const AutoFillTypeSchema = z.union([
  z.literal(false),
  z
    .object({
      schemaName: z.string(),
    })
    .and(AutoFillFieldsSchema),
])

export const AssertionOperatorsSchema = z.enum([
  'equals',
  'notEquals',
  'exists',
  'notExists',
  'isNull',
  'isNotNull',
  'isGreaterThan',
  'isLessThan',
  'isGreaterThanOrEquals',
  'isLessThanOrEquals',
  'contains',
  'notContains',
  'matches',
  'notMatches',
  'hasLength',
  'hasMinLength',
  'hasMaxLength',
  'includes',
  'notIncludes',
  'isEmpty',
  'isNotEmpty',
  'containsSubset',
  'notContainsSubset',
  'isString',
  'isNumber',
  'isBoolean',
  'isArray',
  'isObject',
])

export const AssertionSchema = z.object({
  title: z.string(),
  from: z.enum(['body', 'header']),
  path: z.string(),
  operator: AssertionOperatorsSchema,
  value: z.any().optional(),
  validation: z.enum(['warn', 'error']).default('error'),
})

export const ExtractedValueSchema = z.object({
  name: z.string(),
  from: z.enum(['body', 'header']),
  path: z.string(),
  scope: z.enum(['global', 'environment', 'suite', 'case']),
})

export const ReqSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']),
  endpoint: z.string(),
  queryParams: z.record(z.any()).optional(),
  pathParams: z.record(z.any()).optional(),
  headers: z.record(z.any()).optional(),
  autoFill: AutoFillTypeSchema.optional(),
  payload: z.record(z.any()).optional(),
})

export const ResSchema = z.object({
  schema: z
    .object({
      name: z.string(),
      validation: z.union([z.boolean(), z.literal('warn')]).optional(),
    })
    .optional(),
  validations: z.object({
    statusCode: z.union([z.number(), z.array(z.number())]),
    assertions: z.array(AssertionSchema).optional(),
  }),
  extract: z.array(ExtractedValueSchema).optional(),
})

export const CommonTestStepSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
  wait: z.number().optional(),
  flags: z.array(z.string()).optional(),
  handlers: z.array(z.string()).optional(),
  request: ReqSchema,
  response: ResSchema,
})

export const ReferencedTestStepSchema = z.object({
  ref: z.string(),
  description: z.string().optional(),
})

export const TestStepSchema = z.union([ReferencedTestStepSchema, CommonTestStepSchema])

export const TestcaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
  testType: z.enum(['positive', 'negative']).optional(),
  variables: VariablesSchema.optional(),
  tags: z.array(z.string()),
  steps: z.array(TestStepSchema),
})

export const TestSuiteSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
  tags: z.array(z.string()),
  variables: VariablesSchema.optional(),
  beforeAll: z.array(TestStepSchema).optional(),
  afterAll: z.array(TestStepSchema).optional(),
  testCases: z.array(TestcaseSchema),
})

export const ProjectSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  version: z.string(),
  beforeAll: z.array(TestStepSchema).optional(),
  afterAll: z.array(TestStepSchema).optional(),
  defaultEnv: z.string().optional(),
})

export const EnvironmentVariablesSchema = z.object({
  baseUrl: z.string().url(),
  specUrl: z.string().url().optional(),
  variables: VariablesSchema.optional(),
})

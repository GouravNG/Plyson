import { z } from 'zod'
import { HandlerContext } from '../core/handler-runner.js'
import { ResolvedRequest } from '../core/http-executor.js'

// =========================================================================================================
// Foundation Enums & Types
// =========================================================================================================

export const ScopeSchema = z.enum(['global', 'environment', 'suite', 'case'])
export type Scope = z.infer<typeof ScopeSchema>

export const HTTPMethodSchema = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
export type HTTPMethod = z.infer<typeof HTTPMethodSchema>

export const AssertionOperatorsSchema = z.enum([
  'equals',
  'equalsIgnoreCase',
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
export type AssertionOperators = z.infer<typeof AssertionOperatorsSchema>

// =========================================================================================================
// Foundation Object Schemas & Types
// =========================================================================================================

export const VariablesSchema = z.record(z.string(), z.any())
export type Variables = z.infer<typeof VariablesSchema>

export const GeneratorObjectSchema = z
  .object({
    $gen: z.string(),
    $count: z.number().optional(),
    $module: z.string().optional(),
  })
  .catchall(z.any())
export type GeneratorObject = z.infer<typeof GeneratorObjectSchema>

export const AutoFillFieldsSchema = z.union([
  z.object({ includeFields: z.array(z.string()) }),
  z.object({ excludeFields: z.array(z.string()) }),
  z.object({}).strict(),
])
export type AutoFillFields = z.infer<typeof AutoFillFieldsSchema>

export const AutoFillTypeSchema = z.union([
  z
    .object({
      schemaName: z.string(),
      includeFields: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      schemaName: z.string(),
      excludeFields: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      schemaName: z.string(),
    })
    .strict(),
])
export type AutoFillType = z.infer<typeof AutoFillTypeSchema>

export const AssertionSchema = z.object({
  title: z.string(),
  from: z.enum(['body', 'header']),
  path: z.string(),
  operator: AssertionOperatorsSchema,
  value: z.any().optional(),
  validation: z.enum(['warn', 'error']).default('error').optional(),
})
export type Assertions = z.infer<typeof AssertionSchema>

export const ExtractedValueSchema = z.object({
  name: z.string(),
  from: z.enum(['body', 'header']),
  path: z.string(),
  scope: ScopeSchema,
})
export type ExtractedValue = z.infer<typeof ExtractedValueSchema>

// =========================================================================================================
// Core Request/Response Schemas & Types
// =========================================================================================================

export const ReqSchema = z.object({
  method: HTTPMethodSchema,
  endpoint: z.string(),
  queryParams: z.record(z.string(), z.any()).optional(),
  pathParams: z.record(z.string(), z.any()).optional(),
  headers: z.record(z.string(), z.any()).optional(),
  autoFill: AutoFillTypeSchema.optional(),
  payload: z.record(z.string(), z.any()).optional(),
})
export type Req = z.infer<typeof ReqSchema>

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
export type Res = z.infer<typeof ResSchema>

// =========================================================================================================
// Test Step, Case & Suite Schemas & Types
// =========================================================================================================

export const ActionStepSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
  wait: z.number().optional(),
  action: z.string(),
  args: z.record(z.string(), z.any()).optional(),
})
export type ActionStep = z.infer<typeof ActionStepSchema>

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
export type CommonTestStep = z.infer<typeof CommonTestStepSchema>

export const ReferencedTestStepSchema = z.object({
  ref: z.string(),
  description: z.string().optional(),
})
export type ReferencedTestStep = z.infer<typeof ReferencedTestStepSchema>

export const TestStepSchema = z.union([
  ReferencedTestStepSchema,
  ActionStepSchema,
  CommonTestStepSchema,
])
export type TestStep = z.infer<typeof TestStepSchema>

export const PlaywrightAnnotationTypeSchema = z.enum(['skip', 'fail', 'fixme', 'slow'])
export type PlaywrightAnnotationType = z.infer<typeof PlaywrightAnnotationTypeSchema>

export const CaseAnnotationObjectSchema = z.object({
  type: z.union([PlaywrightAnnotationTypeSchema, z.string()]),
  description: z.string().optional(),
})
export type CaseAnnotationObject = z.infer<typeof CaseAnnotationObjectSchema>

export const CaseAnnotationItemSchema = z.union([
  PlaywrightAnnotationTypeSchema,
  CaseAnnotationObjectSchema,
])
export type CaseAnnotationItem = z.infer<typeof CaseAnnotationItemSchema>

export const CaseAnnotationsSchema = z.union([
  CaseAnnotationItemSchema,
  z.array(CaseAnnotationItemSchema),
])
export type CaseAnnotations = z.infer<typeof CaseAnnotationsSchema>

export const SuiteAnnotationTypeSchema = z.enum(['skip', 'fixme'])
export type SuiteAnnotationType = z.infer<typeof SuiteAnnotationTypeSchema>

export const SuiteAnnotationObjectSchema = z.object({
  type: z.union([SuiteAnnotationTypeSchema, z.string()]),
  description: z.string().optional(),
})
export type SuiteAnnotationObject = z.infer<typeof SuiteAnnotationObjectSchema>

export const SuiteAnnotationItemSchema = z.union([
  SuiteAnnotationTypeSchema,
  SuiteAnnotationObjectSchema,
])
export type SuiteAnnotationItem = z.infer<typeof SuiteAnnotationItemSchema>

export const SuiteAnnotationsSchema = z.union([
  SuiteAnnotationItemSchema,
  z.array(SuiteAnnotationItemSchema),
])
export type SuiteAnnotations = z.infer<typeof SuiteAnnotationsSchema>

export const TestcaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
  testType: z.enum(['positive', 'negative', 'edge']).optional(),
  variables: VariablesSchema.optional(),
  tags: z.array(z.string()),
  annotations: CaseAnnotationsSchema.optional(),
  steps: z.array(TestStepSchema),
})
export type Testcase = z.infer<typeof TestcaseSchema>

export const TestSuiteSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
  tags: z.array(z.string()),
  mode: z.enum(['parallel', 'sequential']).default('sequential'),
  variables: VariablesSchema.optional(),
  annotations: SuiteAnnotationsSchema.optional(),
  beforeAll: z.array(TestStepSchema).optional(),
  afterAll: z.array(TestStepSchema).optional(),
  testCases: z.array(TestcaseSchema),
})
export type TestSuite = z.infer<typeof TestSuiteSchema>

// =========================================================================================================
// Project & Environment Schemas & Types
// =========================================================================================================

export const ProjectSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  version: z.string(),
  mode: z.enum(['parallel', 'sequential']).default('parallel'),
  beforeAll: z.array(TestStepSchema).optional(),
  afterAll: z.array(TestStepSchema).optional(),
  defaultEnv: z.string().optional(),
})
export type Project = z.infer<typeof ProjectSchema>

export const EnvironmentVariablesSchema = z.object({
  baseUrl: z.url(),
  specUrl: z.url().optional(),
  variables: VariablesSchema.optional(),
})
export type EnvironmentVariables = z.infer<typeof EnvironmentVariablesSchema>

// =========================================================================================================
// Utility & Manual Types
// =========================================================================================================

export type VariableValue =
  | string
  | number
  | boolean
  | null
  | any[]
  | Record<string, any>
  | GeneratorObject

export type InlineTestStep = CommonTestStep & { ref?: never }

export type SoftError = {
  title: string
  error: unknown
}

export type HandlerModule = {
  run: (ctx: HandlerContext) => Promise<void>
}

export interface ActionContext {
  args: Record<string, any>
  store: {
    get: (name: string) => VariableValue | undefined
    set: (name: string, value: VariableValue, scope: Scope) => void
  }
  log: (message: string) => void
  warn: (title: string, message: any) => void
  error: (message: any) => void
  playwrightRequest: any // Avoid direct playwright dependency here if possible, or use 'any'
}

export type ActionModule = {
  default: (ctx: ActionContext) => Promise<void>
}

export type ResolvedStep = Omit<CommonTestStep, 'request'> & {
  request: ResolvedRequest
}

# plyson — Technical Implementation

This document covers implementation-level detail for every component in the framework. It is intended for developers building or contributing to the internals. Familiarity with the architecture overview is assumed.

---

## Module structure

```
src/
  cli/
    index.ts                    # entry point, commander setup
    commands/
      run.ts
      sync-schemas.ts
      generate.ts
      validate.ts
      init.ts

  core/
    project-loader.ts           # file discovery, validation, ref resolution
    variable-store.ts           # scoped variable registry
    resolver.ts                 # token interpolation + $gen execution (Faker JSON Schema)
    http-executor.ts            # Playwright APIRequestContext wrapper
    assertion-engine.ts         # operator → expect() mapping
    extraction-engine.ts        # path extraction → store write-back
    handler-runner.ts           # handler module loader + executor
    test-runner.ts              # Playwright test() registration

  path/
    index.ts                    # auto-detect + dispatch
    jsonpath.ts                 # jsonpath-plus wrapper
    jmespath.ts                 # jmespath wrapper

  autofill/
    schema-generator.ts         # generateFromSchema() — OpenAPI schema → payload
    field-filter.ts             # includeFields / excludeFields logic

  errors/
    index.ts                    # typed error hierarchy

  types/
    index.ts                    # re-exports all public types

  utils/
    sleep.ts
    safe-parse-json.ts
    is-gen-object.ts
```

---

## 1. Project Loader

### Responsibility

Discovers, reads, validates, and cross-links all project files into a single in-memory `ProjectGraph` before any test runs.

### Types

```typescript
interface ProjectGraph {
  project: Project
  variables: Variables
  environment: EnvironmentVariables
  schemas: Map<string, JSONSchema> // key = stem e.g. "user"
  handlers: Map<string, HandlerModule> // key = stem e.g. "assert-pagination"
  scripts: Map<string, Testcase> // key = Testcase.id
  suites: TestSuite[]
}

interface HandlerModule {
  run: (ctx: HandlerContext) => Promise<void>
}

class ProjectLoader {
  async load(rootDir: string, env: string): Promise<ProjectGraph>
}
```

### Algorithm

```
load(rootDir, env):
  errors = []

  1. Read + zod-parse project.json
       on failure → errors.push(LoadError)

  2. Read + zod-parse variables.json (optional, default {})

  3. Read + zod-parse environments/{env}.env.json
       if file missing → throw immediately (no env = cannot continue)

  4. Glob schemas/*.schema.json
       JSON.parse each, key by filename stem   → Map<stem, JSONSchema>

  5. Glob handlers/*.handler.ts
       dynamic import() each file
       assert typeof mod.run === "function"
       on missing export → errors.push(LoadError)
       key by filename stem                    → Map<stem, HandlerModule>

  6. Glob scripts/*.script.json
       zod-parse each as Testcase
       check id uniqueness within scripts
       errors.push on duplicate id
       key by Testcase.id                      → Map<id, Testcase>

  7. Glob suites/**/*.test.json
       zod-parse each as TestSuite
       for each testCase:
         check id against scripts map AND previously seen suite ids
         errors.push on any collision          → TestSuite[]

  8. Resolve refs:
       for every TestStep across suites + scripts:
         if step has `ref`:
           look up id in scripts Map
           if not found → errors.push(LoadError)
           if found → replace step in-place with deep clone of script's steps

  9. if errors.length > 0 → throw AggregateLoadError(errors)
     else → return ProjectGraph
```

All errors are collected across steps 1–8 before throwing. The developer sees every problem in a single run, not one at a time.

### Zod schemas (sample)

```typescript
const AssertionOperatorsSchema = z.enum([
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

const AssertionSchema = z.object({
  title: z.string(),
  from: z.enum(['body', 'header']),
  path: z.string(),
  operator: AssertionOperatorsSchema,
  value: z.unknown().optional(),
  validation: z.enum(['warn', 'error']).default('error'),
})

const TestSuiteSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().default(false),
  tags: z.array(z.string()),
  variables: z.record(z.unknown()).optional(),
  beforeAll: z.array(TestStepSchema).optional(),
  afterAll: z.array(TestStepSchema).optional(),
  testCases: z.array(TestcaseSchema),
})
```

---

## 2. Variable Store

### Interface

```typescript
type Scope = 'global' | 'environment' | 'suite' | 'case'

class VariableStore {
  private layers: Record<Scope, Variables> = {
    global: {},
    environment: {},
    suite: {},
    case: {},
  }

  push(scope: Scope, vars: Variables): void
  pop(scope: Scope): void
  get(name: string): VariableValue | undefined
  set(name: string, value: VariableValue, scope: Scope): void
  snapshot(): Variables
}
```

### `get()` — resolution order

```typescript
get(name: string): VariableValue | undefined {
  // reserved globals bypass scope entirely — evaluated fresh every call
  if (name in RESERVED_GLOBALS) return RESERVED_GLOBALS[name]()

  // priority: case > suite > environment > global
  for (const scope of ["case", "suite", "environment", "global"] as Scope[]) {
    if (name in this.layers[scope]) return this.layers[scope][name]
  }

  return undefined  // Resolver decides whether undefined is an error
}
```

### `snapshot()` — used by Phase 1 resolution

Produces a single merged flat object with higher-priority scopes winning:

```typescript
snapshot(): Variables {
  return Object.assign(
    {},
    this.layers.global,
    this.layers.environment,
    this.layers.suite,
    this.layers.case,
  )
}
```

Used during Phase 1 when the entire `variables` block must be resolved at once before any steps run.

### Reserved globals

```typescript
const RESERVED_GLOBALS: Record<string, () => VariableValue> = {
  $timestamp: () => Date.now(),
  $isoDate: () => new Date().toISOString(),
  $guid: () => faker.string.uuid(),
}
```

Reserved tokens are evaluated fresh on every `get()` call. Two usages of `{{$timestamp}}` in the same step return different values. If consistency is needed across steps, capture a value at case start using `$gen: "uuid"` in the `variables` block instead.

### Scope lifecycle

```
startup:
  push("global",      variables.json ?? {})
  push("environment", env.variables ?? {})

suite start:          push("suite", suite.variables ?? {})
suite end:            pop("suite")

case start:           push("case", resolvePhase1(testCase.variables ?? {}))
case end:             pop("case")   ← always runs, even if steps throw

after each step:      set(name, value, scope)   ← extraction write-back
```

---

## 3. Resolver

Transforms raw JSON into executable data by replacing `{{tokens}}` with store values and executing `$gen` objects.

### Interface

```typescript
class Resolver {
  constructor(
    private store: VariableStore,
    private stepTitle = ''
  ) {}

  resolve<T>(input: T): T
  resolveString(input: string): VariableValue
}
```

### `resolve(input)` — recursive walk

```typescript
resolve<T>(input: T): T {
  if (input === null || input === undefined) return input
  if (isGenObject(input))        return this.executeGenerator(input) as T
  if (typeof input === "string") return this.resolveString(input) as T
  if (Array.isArray(input))      return input.map(v => this.resolve(v)) as T
  if (typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input as object).map(([k, v]) => [k, this.resolve(v)])
    ) as T
  }
  return input  // number, boolean — pass through unchanged
}
```

### `resolveString(input)` — token interpolation

```typescript
// whitespace inside {{ }} is trimmed — {{ userId }} === {{userId}}
const TOKEN_RE = /\{\{\s*(.*?)\s*\}\}/g

resolveString(input: string): VariableValue {
  const tokens = [...input.matchAll(TOKEN_RE)]

  if (tokens.length === 0) return input

  // single-token string — preserve original type
  // "{{age}}" where age=30 → returns number 30, not string "30"
  if (tokens.length === 1 && input.trim() === `{{${tokens[0][1].trim()}}}`) {
    const value = this.store.get(tokens[0][1].trim())
    if (value === undefined) throw new ResolutionError(tokens[0][1].trim(), this.stepTitle)
    return value
  }

  // multi-token or mixed string → always returns string
  // "Bearer {{token}}" → "Bearer eyJhbGci..."
  return input.replace(TOKEN_RE, (_, name) => {
    const trimmed = name.trim()
    const value = this.store.get(trimmed)
    if (value === undefined) throw new ResolutionError(trimmed, this.stepTitle)
    return String(value)
  })
}
```

### `$gen` object detection

```typescript
// utils/is-gen-object.ts
function isGenObject(value: unknown): value is GeneratorObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    '$gen' in value &&
    typeof (value as Record<string, unknown>)['$gen'] === 'string'
  )
}
```

### Generator execution

```typescript
private depth = 0
private readonly MAX_DEPTH = 10

private executeGenerator(gen: GeneratorObject): VariableValue {
  // guard against infinite nesting
  if (this.depth >= this.MAX_DEPTH) {
    throw new ResolutionError(
      `$gen nesting exceeds max depth (${this.MAX_DEPTH})`,
      this.stepTitle
    )
  }

  this.depth++
  try {
    const { $gen, $count, $module, ...rawOptions } = gen
    const options = this.resolve(rawOptions)
    const method = findFakerMethod($gen, $module)

    const generate = () =>
      Object.keys(options).length > 0 ? method(options) : method()

    if ($count) return Array.from({ length: $count }, generate)
    return generate()
  } finally {
    this.depth--
  }
}
```

Options are resolved before the generator runs. This makes nested generators work:

```json
{
  "$gen": "string",
  "length": { "$gen": "number", "min": 4, "max": 12 }
}
```

The inner `number` generator runs first, its result becomes `length`, then `string` runs with the resolved length.

### Phase 1 vs Phase 2

```typescript
// Phase 1 — once per test case, variables block only
// $gen here generates once and stays static for the entire case
function resolvePhase1(variables: Variables, store: VariableStore): Variables {
  const resolver = new Resolver(store, 'case variables')
  return Object.fromEntries(Object.entries(variables).map(([k, v]) => [k, resolver.resolve(v)]))
  // result is pushed into store "case" scope
}

// Phase 2 — once per step, full request object
// $gen here generates fresh values on every call (including retries)
function resolvePhase2(request: Req, store: VariableStore, stepTitle: string): Req {
  return new Resolver(store, stepTitle).resolve(request)
}
```

### What gets resolved and when

| Field                       | Phase              | Notes                                           |
| --------------------------- | ------------------ | ----------------------------------------------- |
| `testCase.variables` values | Phase 1            | once per case, stored in case scope             |
| `request.endpoint`          | Phase 2            | `{{tokens}}` only — path syntax is literal      |
| `request.pathParams`        | Phase 2            | substituted into endpoint after resolution      |
| `request.queryParams`       | Phase 2            | all values recursively                          |
| `request.headers`           | Phase 2            | all values recursively                          |
| `request.payload`           | Phase 2            | deep recursive, `$gen` generates fresh per step |
| `assertions[].value`        | Phase 2 (explicit) | resolved in runSteps before assertion runs      |
| `assertions[].path`         | never              | literal JSONPath/JMESPath expression            |
| `extract[].path`            | never              | literal JSONPath/JMESPath expression            |
| `extract[].name`            | never              | literal variable name for store write-back      |

---

## 4. Faker JSON Schema System

Instead of manual generator classes, plyson uses a declarative system that delegates directly to `@faker-js/faker`. This allows the use of any faker method via a simple JSON directive.

### Method Resolution

The resolver finds faker methods using the following priority:

1. **Fully Qualified**: `vehicle.type` → `faker.vehicle.type()`
2. **Module Hint**: `$module: "vehicle"`, `$gen: "type"` → `faker.vehicle.type()`
3. **Auto-Discovery**: `$gen: "fullName"` → Searches all faker modules for a `fullName` method.

### recursive `$count` Support

The system supports generating arrays at any level using the `$count` directive.

- **At Object level**: Generates an array of objects.
- **At Generator level**: Generates an array of primitive values.

```json
{
  "$count": 3,
  "id": { "$gen": "uuid" },
  "name": { "$gen": "fullName" }
}
```

### Type Guard

```typescript
// utils/is-gen-object.ts

function isGenObject(value: unknown): value is GeneratorObject {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    '$gen' in value &&
    typeof (value as Record<string, unknown>)['$gen'] === 'string'
  )
}
```

---

## 5. HTTP Executor

### Types

```typescript
interface ResolvedRequest {
  method: HTTPMethod
  url: string // baseUrl + resolved endpoint
  headers: Record<string, string>
  queryParams: Record<string, string>
  payload?: Record<string, unknown>
  flags?: string[]
}

class HttpExecutor {
  constructor(
    private context: APIRequestContext, // Playwright
    private baseUrl: string,
    private schemas: Map<string, JSONSchema>
  ) {}

  async execute(step: ResolvedStep): Promise<APIResponse>
}
```

### `pathParams` substitution

Applied after Phase 2 resolution, before `baseUrl` is prepended:

```typescript
function applyPathParams(endpoint: string, params: Record<string, unknown>): string {
  return Object.entries(params).reduce(
    (url, [key, val]) => url.replace(`:${key}`, encodeURIComponent(String(val))),
    endpoint
  )
}
// "/users/:id/orders/:orderId" + { id: 42, orderId: 7 }
// → "/users/42/orders/7"
```

### Flags

Applied to headers after resolution, before the request is sent:

```typescript
const FLAGS = {
  SKIP_AUTH: 'skip_auth', // removes Authorization header
} as const

function applyFlags(flags: string[] = [], headers: Record<string, string>): Record<string, string> {
  const result = { ...headers }
  if (flags.includes(FLAGS.SKIP_AUTH)) {
    delete result['Authorization']
    delete result['authorization']
  }
  return result
}
```

### Request dispatch

```typescript
async execute(step: ResolvedStep): Promise<APIResponse> {
  const endpoint = applyPathParams(step.request.endpoint, step.request.pathParams ?? {})
  const url      = this.baseUrl + endpoint
  const headers  = applyFlags(step.flags, step.request.headers ?? {})
  const payload  = await buildPayload(step, this.schemas)

  return this.context.fetch(url, {
    method:  step.request.method,
    headers,
    params:  step.request.queryParams,
    data:    Object.keys(payload).length > 0 ? payload : undefined,
  })
}
```

---

## 6. AutoFill — Schema-to-Payload Generation

### Responsibility

When `autoFill` is set on a step, the executor generates a baseline request payload from the named OpenAPI/JSON Schema, then merges the step's explicit `payload` on top. Explicit values always win on key conflict.

### `generateFromSchema`

```typescript
// autofill/schema-generator.ts

function generateFromSchema(
  schema: JSONSchema,
  filterConfig: AutoFillFields
): Record<string, unknown> {
  const properties = schema.properties ?? {}
  const allFields = Object.keys(properties)
  const activeFields = applyFieldFilter(allFields, filterConfig)

  return Object.fromEntries(
    activeFields.map((field) => [field, generateValueForField(properties[field] as JSONSchema)])
  )
}
```

### Field filtering

```typescript
// autofill/field-filter.ts

function applyFieldFilter(allFields: string[], config: AutoFillFields): string[] {
  if ('includeFields' in config && config.includeFields.length > 0) {
    // only include specified fields, preserving declaration order
    return config.includeFields.filter((f) => allFields.includes(f))
  }

  if ('excludeFields' in config && config.excludeFields.length > 0) {
    return allFields.filter((f) => !config.excludeFields.includes(f))
  }

  return allFields // empty config — include everything
}
```

### `generateValueForField` — type dispatch

```typescript
function generateValueForField(schema: JSONSchema): unknown {
  // schema-provided example wins
  if (schema.example !== undefined) return schema.example

  // enum — use first value as the safe default
  if (schema.enum?.length) return schema.enum[0]

  switch (schema.type) {
    case 'string':
      return generateString(schema)
    case 'number':
    case 'integer':
      return generateNumber(schema)
    case 'boolean':
      return false
    case 'array':
      return []
    case 'object':
      return schema.properties
        ? generateFromSchema(schema, {}) // recurse for nested objects
        : {}
    default:
      return null
  }
}

function generateString(schema: JSONSchema): string {
  if (schema.format === 'email') return faker.internet.email()
  if (schema.format === 'uuid') return faker.string.uuid()
  if (schema.format === 'date') return new Date().toISOString().split('T')[0]
  if (schema.format === 'date-time') return new Date().toISOString()
  if (schema.format === 'uri') return faker.internet.url()

  const length = schema.minLength ?? schema.maxLength ?? 8
  return faker.string.alphanumeric({ length })
}

function generateNumber(schema: JSONSchema): number {
  const min = schema.minimum ?? 0
  const max = schema.maximum ?? 100
  return schema.type === 'integer'
    ? faker.number.int({ min, max })
    : faker.number.float({ min, max, fractionDigits: 2 })
}
```

### Merge precedence example

```
Schema "user" has fields: name, email, role, active

Step config:
  autoFill: { schemaName: "user", includeFields: ["name", "email", "role"] }
  payload:  { role: "admin" }

Step 1 — generateFromSchema produces:
  { name: "John Smith", email: "john@example.com", role: "viewer" }

Step 2 — spread merge:
  { ...generated, ...payload }
  { name: "John Smith", email: "john@example.com", role: "admin" }
                                                         ↑ overridden by explicit payload
```

---

## 7. Path Engine

### Interface

```typescript
class PathEngine {
  // from="body"   → JSONPath or JMESPath against parsed body
  // from="header" → plain header key lookup
  extract(source: unknown, path: string, from: 'body' | 'header', response?: APIResponse): unknown
}
```

### Auto-detection (body only)

```typescript
function extractBody(source: unknown, path: string): unknown {
  return path.startsWith('$') ? extractJsonPath(source, path) : extractJmesPath(source, path)
}
```

### JSONPath (`jsonpath-plus`)

```typescript
import { JSONPath } from 'jsonpath-plus'

function extractJsonPath(source: unknown, path: string): unknown {
  const result = JSONPath({ path, json: source, wrap: true })
  // wrap: true → result is always an array

  // filter expressions always return the full array so isEmpty/isNotEmpty work correctly
  if (isFilterExpression(path)) return result

  // single-value paths — unwrap from the array
  return result.length === 1 ? result[0] : result
}

function isFilterExpression(path: string): boolean {
  return path.includes('[?(')
}
```

### JMESPath (`jmespath`)

```typescript
import jmespath from 'jmespath'

function extractJmesPath(source: unknown, path: string): unknown {
  const result = jmespath.search(source, path)
  // normalise jmespath null → undefined so exists/notExists behave
  // identically regardless of which path syntax was used
  return result === null ? undefined : result
}
```

### Header extraction

```typescript
function extractHeader(response: APIResponse, key: string): string | undefined {
  // Playwright lowercases all response header keys
  return response.headers()[key.toLowerCase()]
}
```

---

## 8. Assertion Engine

### Per-assertion flow

```typescript
async function runAssertion(
  assertion: Assertions,
  body: unknown,
  response: APIResponse,
  softErrors: SoftError[]
): Promise<void> {
  const actual =
    assertion.from === 'header'
      ? extractHeader(response, assertion.path)
      : extractBody(body, assertion.path)

  try {
    applyOperator(actual, assertion.operator, assertion.value)
  } catch (err) {
    if (assertion.validation === 'warn') {
      softErrors.push({ title: assertion.title, error: err })
    } else {
      throw new AssertionError(assertion.title, err)
    }
  }
}
```

### Operator → Playwright mapping

```typescript
function applyOperator(actual: unknown, operator: AssertionOperators, value?: unknown): void {
  const e = expect(actual)

  switch (operator) {
    // Equality — deep (toEqual not toBe — works correctly for objects and arrays)
    case 'equals':
      return e.toEqual(value)
    case 'notEquals':
      return e.not.toEqual(value)

    // Existence
    case 'exists':
      return e.toBeDefined()
    case 'notExists':
      return e.toBeUndefined()
    case 'isNull':
      return e.toBeNull()
    case 'isNotNull':
      return e.not.toBeNull()

    // Numeric
    case 'isGreaterThan':
      return e.toBeGreaterThan(value as number)
    case 'isLessThan':
      return e.toBeLessThan(value as number)
    case 'isGreaterThanOrEquals':
      return e.toBeGreaterThanOrEqual(value as number)
    case 'isLessThanOrEquals':
      return e.toBeLessThanOrEqual(value as number)

    // String
    case 'contains':
      return e.toContain(value)
    case 'notContains':
      return e.not.toContain(value)
    case 'matches':
      return e.toMatch(new RegExp(value as string))
    case 'notMatches':
      return e.not.toMatch(new RegExp(value as string))

    // Array — length
    case 'hasLength':
      return e.toHaveLength(value as number)
    case 'hasMinLength':
      return expect((actual as unknown[]).length).toBeGreaterThanOrEqual(value as number)
    case 'hasMaxLength':
      return expect((actual as unknown[]).length).toBeLessThanOrEqual(value as number)

    // Array — membership
    case 'includes':
      return e.toEqual(expect.arrayContaining([value]))
    case 'notIncludes':
      return e.not.toContain(value)
    case 'isEmpty':
      return e.toHaveLength(0)
    case 'isNotEmpty':
      return expect((actual as unknown[]).length).toBeGreaterThan(0)

    // Object / partial match
    case 'containsSubset':
      return e.toMatchObject(value as object)
    case 'notContainsSubset':
      return e.not.toMatchObject(value as object)

    // Type checks
    case 'isString':
      return e.toEqual(expect.any(String))
    case 'isNumber':
      return e.toEqual(expect.any(Number))
    case 'isBoolean':
      return e.toEqual(expect.any(Boolean))
    case 'isArray':
      return e.toEqual(expect.any(Array))
    case 'isObject': {
      // plain object — must not be null or array
      expect(actual).not.toBeNull()
      expect(Array.isArray(actual)).toBe(false)
      return expect(typeof actual).toBe('object')
    }

    default:
      throw new Error(`Unknown operator "${operator}" — this is a framework bug`)
  }
}
```

### Status code check

```typescript
function checkStatusCode(actual: number, expected: number | number[]): void {
  const acceptable = Array.isArray(expected) ? expected : [expected]
  if (!acceptable.includes(actual)) {
    throw new AssertionError(
      'status code',
      `Expected ${acceptable.join(' or ')}, received ${actual}`
    )
  }
}
```

### Schema validation (AJV)

```typescript
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const ajv = new Ajv({ allErrors: true })
addFormats(ajv)

async function validateSchema(
  body: unknown,
  config: { name: string; validation?: boolean | 'warn' },
  schemas: Map<string, JSONSchema>,
  softErrors: SoftError[]
): Promise<void> {
  const schema = schemas.get(config.name)
  if (!schema) throw new LoadError(`Schema "${config.name}" not found in schemas/`)

  const valid = ajv.validate(schema, body)
  if (!valid) {
    const errors = ajv.errors ?? []
    if (config.validation === 'warn') {
      softErrors.push({ title: `schema:${config.name}`, errors })
    } else {
      throw new SchemaValidationError(config.name, errors)
    }
  }
}
```

---

## 9. Extraction Engine

```typescript
function runExtraction(
  extraction: ExtractedValue,
  body: unknown,
  response: APIResponse,
  store: VariableStore
): void {
  const value =
    extraction.from === 'header'
      ? extractHeader(response, extraction.path)
      : extractBody(body, extraction.path)

  if (value === undefined) {
    throw new ExtractionError(
      `Path "${extraction.path}" returned undefined — cannot extract "${extraction.name}"`
    )
  }

  store.set(extraction.name, value, extraction.scope)
}
```

Runs after assertions. A failed extraction throws immediately — subsequent steps that depend on the extracted variable will not silently receive `undefined`.

---

## 10. Handler Runner

### `HandlerContext`

```typescript
interface HandlerContext {
  request: ResolvedRequest // fully resolved request sent over the wire
  response: APIResponse // raw Playwright APIResponse
  body: unknown // pre-parsed JSON (or raw text if non-JSON)
  status: number // HTTP status code

  store: {
    get(name: string): VariableValue | undefined
    set(name: string, value: VariableValue, scope: Scope): void
  }

  // records a warn-level failure without throwing — appears in report
  warn(title: string, message: string): void
}
```

### Execution

```typescript
async function runHandlers(
  handlerNames: string[],
  ctx: HandlerContext,
  handlers: Map<string, HandlerModule>
): Promise<void> {
  for (const name of handlerNames) {
    const mod = handlers.get(name)
    if (!mod) throw new LoadError(`Handler "${name}" not found — check handlers/ directory`)
    await mod.run(ctx) // unhandled throw → step fails, remaining handlers skipped
  }
}
```

---

## 11. Test Runner

### Playwright suite registration

```typescript
import { test } from '@playwright/test'

export function registerSuites(graph: ProjectGraph, store: VariableStore): void {
  test.beforeAll(async ({ request }) => {
    store.push('global', graph.variables)
    store.push('environment', graph.environment.variables ?? {})
    await runSteps(graph.project.beforeAll ?? [], request, store, graph)
  })

  test.afterAll(async ({ request }) => {
    await runSteps(graph.project.afterAll ?? [], request, store, graph)
  })

  for (const suite of graph.suites) {
    const describeFn = suite.disabled ? test.describe.skip : test.describe

    describeFn(suite.title, () => {
      test.beforeAll(async ({ request }) => {
        store.push('suite', suite.variables ?? {})
        await runSteps(suite.beforeAll ?? [], request, store, graph)
      })

      test.afterAll(async ({ request }) => {
        await runSteps(suite.afterAll ?? [], request, store, graph)
        store.pop('suite')
      })

      for (const testCase of suite.testCases) {
        const testFn = testCase.disabled ? test.skip : test

        testFn(testCase.title, { tag: testCase.tags }, async ({ request }) => {
          // Phase 1 — resolve case variables once before any step runs
          store.push('case', resolvePhase1(testCase.variables ?? {}, store))

          try {
            await runSteps(testCase.steps, request, store, graph)
          } finally {
            store.pop('case') // always clear — even if steps threw
          }
        })
      }
    })
  }
}
```

### `runSteps`

```typescript
async function runSteps(
  steps: TestStep[],
  request: APIRequestContext,
  store: VariableStore,
  graph: ProjectGraph
): Promise<void> {
  const executor = new HttpExecutor(request, graph.environment.baseUrl, graph.schemas)

  for (const step of steps) {
    if (step.disabled) continue
    if (step.wait) await sleep(step.wait)

    // Phase 2 resolution — fresh per step, $gen generates new values every call
    const resolvedRequest = resolvePhase2(step.request, store, step.title)

    const response = await executor.execute({
      ...step,
      request: resolvedRequest,
    })
    const body = await safeParseJson(response)
    const softErrors: SoftError[] = []

    // 1. Status code — always first
    checkStatusCode(response.status(), step.response.validations.statusCode)

    // 2. Response schema (optional)
    if (step.response.schema) {
      await validateSchema(body, step.response.schema, graph.schemas, softErrors)
    }

    // 3. Inline assertions — assertion.value resolved here explicitly
    for (const assertion of step.response.validations.assertions ?? []) {
      const resolved = {
        ...assertion,
        value:
          assertion.value !== undefined
            ? new Resolver(store, step.title).resolve(assertion.value)
            : undefined,
      }
      await runAssertion(resolved, body, response, softErrors)
    }

    // 4. Extraction → store write-back
    for (const extraction of step.response.extract ?? []) {
      runExtraction(extraction, body, response, store)
    }

    // 5. Handlers — last, full context available
    if (step.handlers?.length) {
      const ctx = buildHandlerContext(resolvedRequest, response, body, store, softErrors)
      await runHandlers(step.handlers, ctx, graph.handlers)
    }

    // attach soft errors to Playwright report as annotations
    for (const soft of softErrors) {
      test.info().annotations.push({ type: 'warn', description: soft.title })
    }
  }
}
```

### Utilities

```typescript
// utils/sleep.ts
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

// utils/safe-parse-json.ts
export async function safeParseJson(response: APIResponse): Promise<unknown> {
  const ct = response.headers()['content-type'] ?? ''
  if (!ct.includes('application/json')) return response.text()
  try {
    return await response.json()
  } catch {
    return response.text() // content-type said JSON but body wasn't — degrade gracefully
  }
}
```

---

## 12. Error taxonomy

```typescript
abstract class plysonError extends Error {
  abstract readonly code: string
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

// all load errors collected and thrown together
class AggregateLoadError extends Error {
  constructor(public errors: LoadError[]) {
    super(`${errors.length} load error(s):\n` + errors.map((e) => `  • ${e.message}`).join('\n'))
  }
}

class LoadError extends plysonError {
  readonly code = 'LOAD_ERROR'
  constructor(
    message: string,
    public file?: string
  ) {
    super(message)
  }
}

class ResolutionError extends plysonError {
  readonly code = 'RESOLUTION_ERROR'
  constructor(
    public token: string,
    public stepTitle: string
  ) {
    super(`Unresolved variable "{{${token}}}" in step "${stepTitle}"`)
  }
}

class GeneratorOptionError extends plysonError {
  readonly code = 'GENERATOR_OPTION_ERROR'
  constructor(
    public generator: string,
    message: string
  ) {
    super(`[$gen: ${generator}] ${message}`)
  }
}

class UnknownGeneratorError extends plysonError {
  readonly code = 'UNKNOWN_GENERATOR'
  constructor(public name: string) {
    super(`Unknown generator "$gen: ${name}" — see the generator reference table`)
  }
}

class AssertionError extends plysonError {
  readonly code = 'ASSERTION_ERROR'
  constructor(
    public assertionTitle: string,
    public cause: unknown
  ) {
    super(`Assertion failed: "${assertionTitle}"`)
  }
}

class ExtractionError extends plysonError {
  readonly code = 'EXTRACTION_ERROR'
  constructor(message: string) {
    super(message)
  }
}

class SchemaValidationError extends plysonError {
  readonly code = 'SCHEMA_VALIDATION_ERROR'
  constructor(
    public schemaName: string,
    public validationErrors: unknown[]
  ) {
    super(`Schema validation failed for "${schemaName}"`)
  }
}
```

---

## 13. Supporting types

```typescript
// warn-level failures that don't stop execution
interface SoftError {
  title: string
  error: unknown
}

// a TestStep with request fully resolved (Phase 2 complete)
type ResolvedStep = Omit<CommonTestStep, 'request'> & {
  request: ResolvedRequest
}
```

---

## 14. Third-party dependencies

| Package            | Version | Purpose                                                |
| ------------------ | ------- | ------------------------------------------------------ |
| `@playwright/test` | `^1.44` | Test runner, `expect()`, `APIRequestContext`           |
| `@faker-js/faker`  | `^8`    | All generator implementations                          |
| `jsonpath-plus`    | `^9`    | JSONPath extraction                                    |
| `jmespath`         | `^0.16` | JMESPath extraction                                    |
| `ajv`              | `^8`    | JSON Schema validation (`response.schema`)             |
| `ajv-formats`      | `^3`    | AJV format plugin (`date`, `email`, `uri`)             |
| `glob`             | `^10`   | Recursive file discovery in Project Loader             |
| `zod`              | `^3`    | Runtime type validation of all JSON files at load time |
| `commander`        | `^12`   | CLI command parsing                                    |

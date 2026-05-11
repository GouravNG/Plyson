# play-son — Phase-wise Implementation Plan

Each phase ends with working, tested code. Later phases build on earlier ones without breaking them. IDE prompts are written to be pasted directly into Cursor, Copilot Chat, or any context-aware IDE tool.

---

## Phase 1 — Project scaffold & type system

**Goal:** Empty repo becomes a correctly structured TypeScript project with all types, zod schemas, and error classes defined. No runtime logic yet — just the skeleton everything else will hang on.

**Deliverables:**

- `package.json` with all dependencies declared
- `tsconfig.json` configured for strict mode
- Full `src/` module structure (empty files with correct exports)
- All TypeScript types from the design (`Testcase`, `TestSuite`, `Project`, `Assertions`, `Req`, `Res`, etc.)
- All zod schemas matching the types
- Full error class hierarchy (`PlaysonError`, `LoadError`, `AggregateLoadError`, `ResolutionError`, etc.)
- `vitest` configured and one smoke test passing

**Why first:** Every other phase imports from types and errors. Getting this right early prevents type churn across all subsequent phases.

**Tests:** One smoke test confirming zod schemas parse valid fixtures correctly and reject invalid ones.

---

### Phase 1 IDE Prompt

```
You are scaffolding a new TypeScript library called play-son — a declarative API testing framework built on Playwright.

Create the full project structure and type system. Do not implement any runtime logic yet.

--- PACKAGE SETUP ---

package.json dependencies:
  @playwright/test ^1.44
  @faker-js/faker ^8
  jsonpath-plus ^9
  jmespath ^0.16
  ajv ^8
  ajv-formats ^3
  glob ^10
  zod ^3
  commander ^12

devDependencies:
  typescript ^5
  vitest ^1
  @types/node
  @types/jmespath

tsconfig.json: strict mode, moduleResolution: bundler, target: ES2022, outDir: dist

--- MODULE STRUCTURE ---

Create these files as empty modules with correct named exports (types and classes only, no implementation):

src/types/index.ts                  — re-exports all public types
src/errors/index.ts                 — all error classes
src/generators/registry.ts          — GeneratorRegistry class shell + Generator interface
src/generators/types.ts             — option interfaces for each generator
src/core/variable-store.ts          — VariableStore class shell
src/core/resolver.ts                — Resolver class shell
src/core/project-loader.ts          — ProjectLoader class shell + ProjectGraph interface
src/core/http-executor.ts           — HttpExecutor class shell + ResolvedRequest interface
src/core/assertion-engine.ts        — AssertionEngine shell
src/core/extraction-engine.ts       — ExtractionEngine shell
src/core/handler-runner.ts          — HandlerRunner shell + HandlerContext interface
src/core/test-runner.ts             — registerSuites + runSteps shells
src/path/index.ts                   — PathEngine shell
src/autofill/schema-generator.ts    — generateFromSchema shell
src/utils/sleep.ts                  — sleep utility
src/utils/safe-parse-json.ts        — safeParseJson utility
src/utils/is-gen-object.ts          — isGenObject type guard

--- TYPES TO DEFINE (src/types/index.ts) ---

Define ALL of these exactly — they are the contract for the whole framework:

  Variables = Record<string, any>
  Scope = "global" | "environment" | "suite" | "case"
  HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS"

  GeneratorObject = { $gen: string; [key: string]: any }
  VariableValue = string | number | boolean | null | any[] | Record<string, any> | GeneratorObject

  AutoFillFields = { includeFields: string[] } | { excludeFields: string[] } | Record<string, never>
  AutoFillType = false | ({ schemaName: string } & AutoFillFields)

  AssertionOperators — union of all 27 string literals:
    "equals" | "notEquals" |
    "exists" | "notExists" | "isNull" | "isNotNull" |
    "isGreaterThan" | "isLessThan" | "isGreaterThanOrEquals" | "isLessThanOrEquals" |
    "contains" | "notContains" | "matches" | "notMatches" |
    "hasLength" | "hasMinLength" | "hasMaxLength" |
    "includes" | "notIncludes" | "isEmpty" | "isNotEmpty" |
    "containsSubset" | "notContainsSubset" |
    "isString" | "isNumber" | "isBoolean" | "isArray" | "isObject"

  Assertions = { title, from, path, operator, value?, validation? }
  ExtractedValue = { name, from, path, scope }
  Req = { method, endpoint, queryParams?, pathParams?, headers?, autoFill?, payload? }
  Res = { schema?, validations: { statusCode, assertions? }, extract? }

  CommonTestStep = { title, description?, disabled?, wait?, flags?, handlers?, request, response }
  ReferencedTestStep = { ref: string; description? }
  InlineTestStep = CommonTestStep & { ref?: never }
  TestStep = ReferencedTestStep | InlineTestStep

  Testcase = { id, title, description?, disabled?, testType?, variables?, tags, steps }
  TestSuite = { title, description?, disabled?, tags, variables?, beforeAll?, afterAll?, testCases }
  Project = { title, description?, version, beforeAll?, afterAll?, defaultEnv? }
  EnvironmentVariables = { baseUrl, specUrl?, variables? }

  SoftError = { title: string; error: unknown }
  HandlerModule = { run: (ctx: HandlerContext) => Promise<void> }
  ResolvedStep = Omit<CommonTestStep, "request"> & { request: ResolvedRequest }

--- ZOD SCHEMAS ---

In src/types/index.ts (or a separate src/types/schemas.ts), create zod schemas for:
  AssertionSchema
  ExtractedValueSchema
  ReqSchema
  ResSchema
  TestStepSchema
  TestcaseSchema
  TestSuiteSchema
  ProjectSchema
  EnvironmentVariablesSchema

Each schema must exactly match its TypeScript type. Use z.lazy() for self-referential types if needed.

--- ERROR CLASSES (src/errors/index.ts) ---

abstract class PlaysonError extends Error {
  abstract readonly code: string
  constructor(message: string) { super(message); this.name = this.constructor.name }
}

class AggregateLoadError extends Error — holds LoadError[]
class LoadError extends PlaysonError — code: "LOAD_ERROR", optional file?: string
class ResolutionError extends PlaysonError — code: "RESOLUTION_ERROR", token + stepTitle
class GeneratorOptionError extends PlaysonError — code: "GENERATOR_OPTION_ERROR", generator name
class UnknownGeneratorError extends PlaysonError — code: "UNKNOWN_GENERATOR", generator name
class AssertionError extends PlaysonError — code: "ASSERTION_ERROR", assertionTitle + cause
class ExtractionError extends PlaysonError — code: "EXTRACTION_ERROR"
class SchemaValidationError extends PlaysonError — code: "SCHEMA_VALIDATION_ERROR", schemaName + validationErrors[]

--- TESTS ---

Create src/__tests__/phase1.test.ts using vitest.
Test that zod schemas:
  - parse a valid TestSuite fixture without errors
  - parse a valid Assertions fixture with all operator variants
  - reject a TestSuite missing required fields
  - reject an Assertions object with an invalid operator string
  - apply the default value "error" to validation field when omitted

All tests must pass with `npx vitest run`.
```

---

## Phase 2 — Variable Store & Resolver

**Goal:** The `VariableStore` and `Resolver` are fully implemented and unit tested. This is the most foundational runtime component — everything else depends on correct variable resolution.

**Deliverables:**

- `VariableStore` — push/pop/get/set/snapshot with correct 4-scope priority
- Reserved globals (`$timestamp`, `$isoDate`, `$guid`)
- `Resolver` — recursive walk, token interpolation, type preservation, whitespace tolerance
- `isGenObject` utility
- `resolvePhase1` and `resolvePhase2` functions
- Full unit test suite

**Why here:** Variable resolution is self-contained with no external dependencies. Proving it correct before building anything else prevents subtle resolution bugs from infecting every later component.

---

### Phase 2 IDE Prompt

```
Implement the VariableStore and Resolver for the play-son framework.
These are in src/core/variable-store.ts and src/core/resolver.ts.
All types and error classes are already defined in src/types and src/errors.

--- VARIABLE STORE (src/core/variable-store.ts) ---

class VariableStore:

  private layers: Record<Scope, Variables> initialised as four empty objects

  push(scope, vars):
    assign vars into this.layers[scope]
    (replace the scope entirely — don't merge with existing values)

  pop(scope):
    reset this.layers[scope] to {}

  get(name):
    1. Check RESERVED_GLOBALS first — if name in map, call and return the function
    2. Walk ["case", "suite", "environment", "global"] in order
    3. Return first match, or undefined if not found

  set(name, value, scope):
    this.layers[scope][name] = value

  snapshot():
    return Object.assign({}, global, environment, suite, case)
    (later scopes overwrite earlier — case wins)

RESERVED_GLOBALS:
  "$timestamp" → () => Date.now()
  "$isoDate"   → () => new Date().toISOString()
  "$guid"      → () => faker.string.uuid()   (import from @faker-js/faker)

--- RESOLVER (src/core/resolver.ts) ---

TOKEN_RE = /\{\{\s*(.*?)\s*\}\}/g   (trims whitespace inside {{ }})

class Resolver:
  constructor(store: VariableStore, stepTitle = "")
  private depth = 0
  private readonly MAX_DEPTH = 10

  resolve<T>(input: T): T
    Walk the value recursively:
    - null/undefined → return as-is
    - isGenObject(input) → this.executeGenerator(input)
    - string → this.resolveString(input)
    - array → input.map(v => this.resolve(v))
    - plain object → Object.fromEntries(entries.map([k,v] => [k, this.resolve(v)]))
    - number/boolean → return as-is

  resolveString(input: string): VariableValue
    tokens = [...input.matchAll(TOKEN_RE)]
    if tokens.length === 0 → return input

    if tokens.length === 1 AND input.trim() === "{{" + tokens[0][1].trim() + "}}"
      // single-token path — preserve original type
      value = store.get(tokens[0][1].trim())
      if undefined → throw new ResolutionError(token, this.stepTitle)
      return value    // number, boolean, object — not forced to string

    // mixed/multi-token — always string
    return input.replace(TOKEN_RE, (_, name) => {
      trimmed = name.trim()
      value = store.get(trimmed)
      if undefined → throw new ResolutionError(trimmed, this.stepTitle)
      return String(value)
    })

  private executeGenerator(gen: GeneratorObject): VariableValue
    if this.depth >= MAX_DEPTH → throw ResolutionError("$gen nesting too deep", this.stepTitle)
    this.depth++
    try:
      { $gen, ...rawOptions } = gen
      options = this.resolve(rawOptions)      // resolve options first (enables nested $gen)
      return GeneratorRegistry.run($gen, options)
    finally:
      this.depth--

--- IS-GEN-OBJECT (src/utils/is-gen-object.ts) ---

function isGenObject(value: unknown): value is GeneratorObject
  typeof === "object" && not null && not array && "$gen" in value && typeof value.$gen === "string"

--- PHASE FUNCTIONS ---

export function resolvePhase1(variables: Variables, store: VariableStore): Variables
  Creates a new Resolver(store, "case variables")
  For each [key, value] in variables: resolved[key] = resolver.resolve(value)
  Returns the resolved object (caller pushes it into case scope)

export function resolvePhase2(request: Req, store: VariableStore, stepTitle: string): Req
  return new Resolver(store, stepTitle).resolve(request)

--- TESTS (src/__tests__/variable-store.test.ts) ---

Scope priority:
  Push value X into global, Y into suite for same key → get() returns Y
  Push value Y into suite, Z into case for same key → get() returns Z
  Pop case scope → get() returns suite value again

Reserved globals:
  get("$timestamp") returns a number close to Date.now()
  get("$isoDate") returns a valid ISO string
  get("$guid") returns a string matching UUID v4 regex

Undefined behaviour:
  get() returns undefined for unknown name (no throw — store is not the thrower)

--- TESTS (src/__tests__/resolver.test.ts) ---

Token interpolation:
  "{{name}}" where name="Alice" → returns string "Alice"
  "Hello {{name}}" where name="Alice" → returns "Hello Alice"
  "{{age}}" where age=30 → returns number 30 (type preserved, not "30")
  "{{active}}" where active=false → returns boolean false (type preserved)
  "user_{{id}}_{{ts}}" where id=42, ts=999 → returns "user_42_999"
  "{{ name }}" (whitespace inside braces) where name="Bob" → returns "Bob"

Missing token:
  "{{missing}}" with empty store → throws ResolutionError with token name in message

Array resolution:
  ["{{a}}", "{{b}}"] where a="x", b="y" → ["x", "y"]

Object resolution:
  { key: "{{val}}" } where val="hello" → { key: "hello" }

Nested $gen guard:
  A GeneratorObject whose option is another GeneratorObject whose option is... (11 deep)
  → throws ResolutionError mentioning depth limit
  (mock GeneratorRegistry.run to recurse — use vi.mock or a spy)

Phase 1 vs Phase 2:
  resolvePhase1 resolves variables and returns a plain object (no side effects on store)
  resolvePhase2 resolves a Req object in full

All tests pass with npx vitest run.
```

---

## Phase 3 — Generator Registry & Data Generation

**Goal:** All 14 built-in generators implemented, registered, tested. The full `$gen` system works including nested resolution and option validation.

**Deliverables:**

- `GeneratorRegistry` with `register` / `run` / `has`
- `registerBuiltins()` function
- All 14 generator classes with full option handling
- Option validation with `GeneratorOptionError` before Faker is called
- Unit tests for every generator including edge cases and bad options
- Integration test: resolver + store + generators end-to-end

---

### Phase 3 IDE Prompt

```
Implement the GeneratorRegistry and all built-in generators for play-son.
Files: src/generators/registry.ts and src/generators/*.generator.ts
Types and errors are in src/types and src/errors. Resolver is already done.

--- REGISTRY (src/generators/registry.ts) ---

interface Generator<O extends Record<string, unknown> = Record<string, unknown>> {
  run(options: O): VariableValue
}

class GeneratorRegistry:
  private static generators = new Map<string, Generator>()

  static register(name, generator): void — add to map
  static run(name, options): VariableValue — get from map, throw UnknownGeneratorError if missing, call run
  static has(name): boolean

export function registerBuiltins(): void — registers all 14 generators below

--- GENERATORS ---

Each in its own file. Each implements Generator<OptionsInterface>.
Validate options before calling Faker and throw GeneratorOptionError with a clear message on bad input.

1. StringGenerator (src/generators/string.generator.ts)
   Options: { length: number (required, >= 1), numeric?: boolean, upper?: boolean, lower?: boolean }
   - numeric=true → faker.string.numeric({ length, allowLeadingZeros: true })
   - casing = upper ? "upper" : lower ? "lower" : "mixed"
   - default → faker.string.alphanumeric({ length, casing })
   - throw if length < 1 or not a number

2. NumberGenerator (src/generators/number.generator.ts)
   Options: { min?: number (default 0), max?: number (default 1_000_000), float?: boolean, precision?: number (default 2) }
   - throw if min > max
   - float=true → faker.number.float({ min, max, fractionDigits: precision })
   - default → faker.number.int({ min, max })

3. BooleanGenerator (src/generators/boolean.generator.ts)
   Options: { probability?: number (default 0.5, must be 0–1) }
   - throw if probability < 0 || > 1
   - faker.datatype.boolean({ probability })

4. DateGenerator (src/generators/date.generator.ts)
   Options: { format?: "iso" | "timestamp" | "date" }
   - returns new Date() formatted per format option
   - "iso" → toISOString() (default), "timestamp" → getTime(), "date" → toISOString().split("T")[0]

5. PastDateGenerator — same options + within?: string (default "30d")
   - parse within with parseWithin(within) → { days?, months?, years? }
   - valid formats: "7d", "3M", "1y" — throw GeneratorOptionError on anything else
   - faker.date.past({ ...parsed, refDate: new Date() }) then format

6. FutureDateGenerator — identical to PastDateGenerator but faker.date.future(...)

7. UuidGenerator — no options, returns faker.string.uuid()

8. EmailGenerator
   Options: { domain?: string, prefix?: string }
   - faker.internet.email({ provider: domain })
   - if prefix: split result on "@", return prefix + "_" + alphanumeric(6) + "@" + host

9. FullNameGenerator
   Options: { sex?: "male" | "female" }
   - faker.person.fullName({ sex })

10. FirstNameGenerator
    Options: { sex?: "male" | "female" }
    - faker.person.firstName(sex)

11. LastNameGenerator — no options, faker.person.lastName()

12. PhoneNumberGenerator
    Options: { style?: "international" | "national" (default "national") }
    - faker.phone.number({ style })

13. UrlGenerator — no options, faker.internet.url()

14. IpAddressGenerator — no options, faker.internet.ip()

parseWithin helper (shared, put in src/generators/date.generator.ts or a utils file):
  parseWithin(within: string): { days?, months?, years? }
  regex: /^(\d+)(d|M|y)$/
  d → days, M → months, y → years
  throw GeneratorOptionError("date", `Invalid "within": "${within}". Use e.g. "7d", "3M", "1y"`) on no match

--- TESTS (src/__tests__/generators.test.ts) ---

For each generator:
  - Happy path: valid options produce correct type output
  - Bad options: throw GeneratorOptionError with generator name in message

StringGenerator:
  length 8 alphanumeric → 8 char string
  length 6 numeric → 6 char string matching /^\d{6}$/
  length 4 upper → /^[A-Z]{4}$/
  length 0 → throws GeneratorOptionError
  missing length → throws GeneratorOptionError

NumberGenerator:
  min 1 max 10 → number between 1 and 10
  float=true → has decimal component
  min 50 max 10 → throws GeneratorOptionError

BooleanGenerator:
  probability 0 → always false
  probability 1 → always true
  probability 1.5 → throws GeneratorOptionError

PastDateGenerator:
  within "7d" → ISO string earlier than now
  within "bad" → throws GeneratorOptionError

FutureDateGenerator:
  within "1y", format "date" → string matching /^\d{4}-\d{2}-\d{2}$/

EmailGenerator:
  domain "test.com" → result ends with "@test.com"
  prefix "qa" → result starts with "qa_"

UnknownGeneratorError:
  GeneratorRegistry.run("nonexistent", {}) → throws UnknownGeneratorError

--- INTEGRATION TEST (src/__tests__/resolver-generators.test.ts) ---

Set up a VariableStore with some values.
Call resolvePhase1 with variables containing $gen objects.
Assert the resolved values are the correct types.

Nested $gen:
  { $gen: "string", length: { $gen: "number", min: 4, max: 4 } }
  → resolves to a 4-character string

Mixed variables:
  variables = { name: { $gen: "fullName" }, ref: "user_{{name}}" }
  resolvePhase1 resolves name first, then ref uses the resolved name
  → ref starts with "user_"

All tests pass with npx vitest run — no regressions on phase 1 or 2 tests.
```

---

## Phase 4 — Project Loader & HTTP Executor

**Goal:** The framework can discover files, validate them, resolve refs, and send HTTP requests. By the end of this phase you can point the loader at a real project directory and get a `ProjectGraph` back.

**Deliverables:**

- `ProjectLoader` — file discovery, zod parsing, ref resolution, aggregate error collection
- `HttpExecutor` — pathParams, autoFill merge, flags, Playwright `APIRequestContext` dispatch
- `generateFromSchema` and field filter for autoFill
- Unit tests with fixture directories and mocked `APIRequestContext`

---

### Phase 4 IDE Prompt

```
Implement the ProjectLoader and HttpExecutor for play-son.
Files: src/core/project-loader.ts, src/core/http-executor.ts, src/autofill/

All types, errors, and schemas from phase 1 are available.
Use glob for file discovery. Use zod schemas for parsing. Do not implement test runner yet.

--- PROJECT LOADER (src/core/project-loader.ts) ---

class ProjectLoader:
  async load(rootDir: string, env: string): Promise<ProjectGraph>

Algorithm — collect ALL errors before throwing:
  errors: LoadError[] = []

  1. Read + zodParse(ProjectSchema) project.json
     catch → errors.push(new LoadError(msg, "project.json"))

  2. Try to read variables.json — if missing default to {}
     if present, zodParse(VariablesSchema) — catch → errors.push

  3. Read environments/{env}.env.json
     if file does not exist → throw immediately (new LoadError) — cannot continue without env
     zodParse(EnvironmentVariablesSchema) — catch → errors.push

  4. Glob schemas/*.schema.json
     for each: JSON.parse, key by path.basename(file, ".schema.json")
     parse errors → errors.push (continue)

  5. Glob handlers/*.handler.ts
     for each: await import(file)
     if typeof mod.run !== "function" → errors.push(new LoadError(`Handler "${stem}" missing run export`, file))
     key by stem

  6. Glob scripts/*.script.json
     for each: zodParse(TestcaseSchema)
     check id uniqueness across all scripts → errors.push on duplicate
     key by id

  7. Glob suites/**/*.test.json
     for each: zodParse(TestSuiteSchema)
     for each testCase: check id against scripts map + all seen suite ids → errors.push on collision

  8. Resolve refs:
     Walk every TestStep in suites[*].testCases[*].steps and scripts[*].steps
     if step.ref is defined:
       find the script by id
       if not found → errors.push(new LoadError(`Ref "${step.ref}" not found`))
       if found → replace step with deep clone of the script's steps

  9. if errors.length > 0 → throw new AggregateLoadError(errors)
     return ProjectGraph

--- HTTP EXECUTOR (src/core/http-executor.ts) ---

interface ResolvedRequest — method, url (baseUrl+endpoint), headers, queryParams, payload?, flags?

class HttpExecutor:
  constructor(context: APIRequestContext, baseUrl: string, schemas: Map<string, JSONSchema>)

  async execute(step: ResolvedStep): Promise<APIResponse>
    1. applyPathParams(step.request.endpoint, step.request.pathParams ?? {})
       replace :param with encodeURIComponent(String(value)) for each param
    2. url = this.baseUrl + endpoint
    3. headers = applyFlags(step.flags, step.request.headers ?? {})
    4. payload = await buildPayload(step, this.schemas)
    5. return this.context.fetch(url, { method, headers, params: queryParams, data: payload || undefined })

applyFlags(flags, headers):
  copy headers
  if "skip_auth" in flags → delete Authorization and authorization keys
  return copy

buildPayload(step, schemas):
  if !step.request.autoFill → return step.request.payload ?? {}
  get schema by schemaName from schemas map
  if not found → throw LoadError
  generated = generateFromSchema(schema, filterConfig)
  return { ...generated, ...step.request.payload }  (explicit wins)

--- AUTOFILL (src/autofill/schema-generator.ts) ---

function generateFromSchema(schema: JSONSchema, filterConfig: AutoFillFields): Record<string, unknown>
  properties = schema.properties ?? {}
  allFields = Object.keys(properties)
  activeFields = applyFieldFilter(allFields, filterConfig)
  return Object.fromEntries(activeFields.map(f => [f, generateValueForField(properties[f])]))

function generateValueForField(schema: JSONSchema): unknown
  if schema.example !== undefined → return schema.example
  if schema.enum?.length → return schema.enum[0]
  switch schema.type:
    "string"  → generateString(schema)
    "number" | "integer" → generateNumber(schema)
    "boolean" → false
    "array"   → []
    "object"  → schema.properties ? generateFromSchema(schema, {}) : {}
    default   → null

generateString(schema):
  "email" → faker.internet.email()
  "uuid"  → faker.string.uuid()
  "date"  → new Date().toISOString().split("T")[0]
  "date-time" → new Date().toISOString()
  "uri"   → faker.internet.url()
  fallback → faker.string.alphanumeric({ length: schema.minLength ?? schema.maxLength ?? 8 })

generateNumber(schema):
  min = schema.minimum ?? 0, max = schema.maximum ?? 100
  integer → faker.number.int, otherwise faker.number.float

function applyFieldFilter(allFields, config):
  "includeFields" in config → return includeFields.filter(f => allFields.includes(f))
  "excludeFields" in config → return allFields.filter(f => !excludeFields.includes(f))
  default → return allFields

--- TESTS (src/__tests__/project-loader.test.ts) ---

Create a test fixtures directory: src/__tests__/fixtures/valid-project/ with minimal valid files.

Happy path:
  load("fixtures/valid-project", "dev") → returns ProjectGraph with correct structure

Missing env file:
  load("fixtures/valid-project", "nonexistent") → throws immediately (not AggregateLoadError)

Broken suite file:
  load a fixture with an invalid *.test.json → AggregateLoadError with 1 error

Duplicate ids:
  two scripts with same id → AggregateLoadError mentioning the duplicate

Broken ref:
  a step with ref "nonexistent-id" → AggregateLoadError mentioning the ref

Multiple errors at once:
  fixture with duplicate id + broken ref → AggregateLoadError with errors.length === 2

Handler missing run export:
  a handler file that exports nothing → errors includes LoadError for that file

--- TESTS (src/__tests__/http-executor.test.ts) ---

Mock APIRequestContext using vi.fn().

pathParams:
  endpoint "/users/:id" + pathParams { id: 42 } → url contains "/users/42"

flags:
  headers with Authorization + skip_auth flag → Authorization removed from fetch call

autoFill merge:
  schema has { name: string, role: string }
  payload: { role: "admin" }
  result payload has role: "admin" (explicit wins) and name from schema

payload undefined when empty:
  no autoFill, no payload → data param is undefined in fetch call

All tests pass with npx vitest run — no regressions.
```

---

## Phase 5 — Assertion, Extraction & Handler Engines

**Goal:** The three post-response engines are complete. Every assertion operator maps correctly to a Playwright `expect()` call. Path extraction works for JSONPath, JMESPath, and headers.

**Deliverables:**

- `PathEngine` — JSONPath + JMESPath auto-detection, filter expression handling, header extraction
- `AssertionEngine` — all 27 operators, soft error collection, status code check, AJV schema validation
- `ExtractionEngine` — path extraction + store write-back
- `HandlerRunner` — load + execute in order
- Unit tests for every operator and path expression type

---

### Phase 5 IDE Prompt

```
Implement the PathEngine, AssertionEngine, ExtractionEngine, and HandlerRunner for play-son.
All previous phases are complete. Import expect from @playwright/test.

--- PATH ENGINE (src/path/index.ts) ---

import { JSONPath } from "jsonpath-plus"
import jmespath from "jmespath"

class PathEngine:

  extract(source: unknown, path: string): unknown
    path.startsWith("$") → extractJsonPath(source, path)
    else → extractJmesPath(source, path)

  extractJsonPath(source, path):
    result = JSONPath({ path, json: source, wrap: true })
    isFilterExpression(path) → return result   (always array — for isEmpty/isNotEmpty)
    result.length === 1 → return result[0]     (unwrap single value)
    return result

  isFilterExpression(path): path.includes("[?(")

  extractJmesPath(source, path):
    result = jmespath.search(source, path)
    return result === null ? undefined : result   (normalise jmespath null → undefined)

  extractHeader(response: APIResponse, key: string): string | undefined
    return response.headers()[key.toLowerCase()]

--- ASSERTION ENGINE (src/core/assertion-engine.ts) ---

Status code check (runs first, always):
  checkStatusCode(actual: number, expected: number | number[])
  acceptable = Array.isArray(expected) ? expected : [expected]
  if !acceptable.includes(actual) → throw AssertionError("status code", message)

Schema validation (if response.schema configured):
  Import Ajv + ajv-formats
  const ajv = new Ajv({ allErrors: true }); addFormats(ajv)
  validate body against schema
  on failure:
    validation === "warn" → push to softErrors
    else → throw SchemaValidationError

Per-assertion flow:
  actual = from === "header" ? pathEngine.extractHeader(response, path) : pathEngine.extract(body, path)
  try: applyOperator(actual, operator, value)
  catch:
    validation === "warn" → softErrors.push({ title, error })
    else → throw AssertionError(title, err)

applyOperator(actual, operator, value) — switch on operator:
  "equals"             → expect(actual).toEqual(value)
  "notEquals"          → expect(actual).not.toEqual(value)
  "exists"             → expect(actual).toBeDefined()
  "notExists"          → expect(actual).toBeUndefined()
  "isNull"             → expect(actual).toBeNull()
  "isNotNull"          → expect(actual).not.toBeNull()
  "isGreaterThan"      → expect(actual).toBeGreaterThan(value)
  "isLessThan"         → expect(actual).toBeLessThan(value)
  "isGreaterThanOrEquals" → expect(actual).toBeGreaterThanOrEqual(value)
  "isLessThanOrEquals" → expect(actual).toBeLessThanOrEqual(value)
  "contains"           → expect(actual).toContain(value)
  "notContains"        → expect(actual).not.toContain(value)
  "matches"            → expect(actual).toMatch(new RegExp(value))
  "notMatches"         → expect(actual).not.toMatch(new RegExp(value))
  "hasLength"          → expect(actual).toHaveLength(value)
  "hasMinLength"       → expect((actual as any[]).length).toBeGreaterThanOrEqual(value)
  "hasMaxLength"       → expect((actual as any[]).length).toBeLessThanOrEqual(value)
  "includes"           → expect(actual).toEqual(expect.arrayContaining([value]))
  "notIncludes"        → expect(actual).not.toContain(value)
  "isEmpty"            → expect(actual).toHaveLength(0)
  "isNotEmpty"         → expect((actual as any[]).length).toBeGreaterThan(0)
  "containsSubset"     → expect(actual).toMatchObject(value)
  "notContainsSubset"  → expect(actual).not.toMatchObject(value)
  "isString"           → expect(actual).toEqual(expect.any(String))
  "isNumber"           → expect(actual).toEqual(expect.any(Number))
  "isBoolean"          → expect(actual).toEqual(expect.any(Boolean))
  "isArray"            → expect(actual).toEqual(expect.any(Array))
  "isObject"           → expect(actual).not.toBeNull(); expect(Array.isArray(actual)).toBe(false); expect(typeof actual).toBe("object")
  default              → throw new Error(`Unknown operator "${operator}"`)

--- EXTRACTION ENGINE (src/core/extraction-engine.ts) ---

function runExtraction(extraction, body, response, store):
  value = extraction.from === "header"
    ? pathEngine.extractHeader(response, extraction.path)
    : pathEngine.extract(body, extraction.path)
  if value === undefined → throw ExtractionError(...)
  store.set(extraction.name, value, extraction.scope)

--- HANDLER RUNNER (src/core/handler-runner.ts) ---

HandlerContext interface (as defined in types):
  request, response, body, status, store { get, set }, warn(title, message)

async function runHandlers(names, ctx, handlers):
  for name of names:
    mod = handlers.get(name)
    if !mod → throw LoadError(...)
    await mod.run(ctx)   // throw propagates — stops remaining handlers

--- TESTS (src/__tests__/path-engine.test.ts) ---

JSONPath single value:
  extract({ data: { id: "abc" } }, "$.data.id") → "abc"

JSONPath filter expression:
  extract({ items: [{s:"active"},{s:"disabled"}] }, "$.items[?(@.s=='disabled')]")
  → returns array with one item (not unwrapped)

JSONPath wildcard:
  extract({ items: [{s:"a"},{s:"b"}] }, "$.items[*].s") → ["a", "b"]

JMESPath:
  extract({ data: { id: "abc" } }, "data.id") → "abc"
  extract({ items: [{s:"x"}] }, "items[?s=='x']") → array result

JMESPath missing path:
  extract({}, "does.not.exist") → undefined (not null)

Header extraction:
  extractHeader with key "Content-Type" (mixed case) → finds "content-type" header value

--- TESTS (src/__tests__/assertion-engine.test.ts) ---

Test every operator with a matching actual/value pair → passes (no throw)
Test every operator with a non-matching pair → throws AssertionError

Specific cases:
  "equals" with objects { a: 1 } === { a: 1 } → passes (deep equality)
  "equals" with arrays [1,2] === [1,2] → passes
  "containsSubset" with { a:1,b:2 } against { a:1 } → passes
  "isObject" with null → throws
  "isObject" with [] → throws
  "isObject" with {} → passes

Filter path + isEmpty/isNotEmpty:
  body = { items: [{status:"disabled"},{status:"active"}] }
  path "$.items[?(@.status=='disabled')]" + operator "isNotEmpty" → passes
  path "$.items[?(@.status=='disabled')]" + operator "isEmpty" → throws

Soft errors:
  assertion with validation:"warn" fails → does NOT throw, pushes to softErrors array
  softErrors has one entry with correct title

Status code:
  checkStatusCode(200, 200) → passes
  checkStatusCode(404, [200, 201]) → throws AssertionError
  checkStatusCode(201, [200, 201]) → passes

--- TESTS (src/__tests__/extraction-engine.test.ts) ---

Successful extraction:
  body = { data: { token: "abc123" } }
  extraction path "$.data.token" scope "suite"
  → store.get("token") returns "abc123" from suite scope

Missing path:
  path that returns undefined → throws ExtractionError with path in message

Scope write-back:
  scope "global" → store.set called with scope "global"

All tests pass with npx vitest run — no regressions on any previous phase.
```

---

## Phase 6 — Test Runner & CLI

**Goal:** The framework is fully working end-to-end. `playson run --env dev` discovers suites, registers them as Playwright tests, and executes them. CLI commands are wired up.

**Deliverables:**

- `registerSuites` — Playwright `test.describe` / `test()` registration
- `runSteps` — full step execution pipeline in correct order
- `safeParseJson` and `sleep` utilities
- All 5 CLI commands wired with `commander`
- E2E test suite against a mock API server (`msw` or a real local Express server)

**Why last:** The test runner requires every other component to be correct. Building it last means the E2E tests catch real integration issues rather than mocking everything away.

---

### Phase 6 IDE Prompt

```
Implement the TestRunner and CLI for play-son.
All previous phases are complete and tested. This phase wires everything together.

--- UTILITIES ---

src/utils/sleep.ts:
  export const sleep = (ms: number): Promise<void> => new Promise(res => setTimeout(res, ms))

src/utils/safe-parse-json.ts:
  export async function safeParseJson(response: APIResponse): Promise<unknown>
    ct = response.headers()["content-type"] ?? ""
    if !ct.includes("application/json") → return response.text()
    try: return await response.json()
    catch: return response.text()

--- TEST RUNNER (src/core/test-runner.ts) ---

import { test } from "@playwright/test"

export function registerSuites(graph: ProjectGraph, store: VariableStore): void

  test.beforeAll:
    store.push("global", graph.variables)
    store.push("environment", graph.environment.variables ?? {})
    await runSteps(graph.project.beforeAll ?? [], request, store, graph)

  test.afterAll:
    await runSteps(graph.project.afterAll ?? [], ...)

  for each suite in graph.suites:
    describeFn = suite.disabled ? test.describe.skip : test.describe

    describeFn(suite.title, () => {
      test.beforeAll: store.push("suite", suite.variables ?? {}); runSteps(suite.beforeAll)
      test.afterAll: runSteps(suite.afterAll); store.pop("suite")

      for each testCase:
        testFn = testCase.disabled ? test.skip : test
        testFn(testCase.title, { tag: testCase.tags }, async ({ request }) => {
          store.push("case", resolvePhase1(testCase.variables ?? {}, store))
          try: await runSteps(testCase.steps, request, store, graph)
          finally: store.pop("case")
        })
    })

async function runSteps(steps, request, store, graph):
  executor = new HttpExecutor(request, graph.environment.baseUrl, graph.schemas)

  for each step:
    if step.disabled → continue
    if step.wait → await sleep(step.wait)

    resolvedRequest = resolvePhase2(step.request, store, step.title)
    response = await executor.execute({ ...step, request: resolvedRequest })
    body = await safeParseJson(response)
    softErrors = []

    checkStatusCode(response.status(), step.response.validations.statusCode)

    if step.response.schema:
      await validateSchema(body, step.response.schema, graph.schemas, softErrors)

    for each assertion in step.response.validations.assertions ?? []:
      resolvedValue = assertion.value !== undefined
        ? new Resolver(store, step.title).resolve(assertion.value)
        : undefined
      await runAssertion({ ...assertion, value: resolvedValue }, body, response, softErrors)

    for each extraction in step.response.extract ?? []:
      runExtraction(extraction, body, response, store)

    if step.handlers?.length:
      ctx = buildHandlerContext(resolvedRequest, response, body, store, softErrors)
      await runHandlers(step.handlers, ctx, graph.handlers)

    for each soft in softErrors:
      test.info().annotations.push({ type: "warn", description: soft.title })

--- CLI (src/cli/index.ts + commands/) ---

Use commander. Entry point: src/cli/index.ts

Commands:

playson run [paths...]
  Required flag: --env, -e (string) unless project.json has defaultEnv
  Pass all unrecognised flags through to playwright test
  Before running: load ProjectGraph, register suites, invoke playwright programmatically

playson validate [path] [options]
  --type, -t: "project" | "suite" | "script" | "handler" | "env" | "var"
  --repair: boolean
  Load ProjectGraph (catch AggregateLoadError, display each error clearly)
  If --repair: interactive prompts (use @inquirer/prompts or readline)

playson generate <resource> <name> [options]
  g var <key> [value]          → append to variables.json
  g env-var <key> <value> --env <name> → update all env files
  g handler <name>             → create handlers/<name>.handler.ts with run boilerplate
  g script <name>              → create scripts/<name>.script.json with unique id (uuid)
  g suite <name>               → create suites/<name>.test.json with boilerplate

playson sync-schemas [options]
  --env, -e: string
  --all (default) | --name <name>
  --skip-stale: boolean
  Fetch specUrl from env file, parse OpenAPI spec, write schemas/<name>.schema.json for each

playson init [project-name]
  Create full directory structure with placeholder files

--- E2E TESTS (src/__tests__/e2e/full-run.test.ts) ---

Strategy: start a real local HTTP server (use express or msw node adapter) before tests.
Create a minimal valid play-son project in a temp directory pointing at the local server.
Use PlaywrightRunner or spawn a child process running `playson run --env test`.

Scenarios to cover:

1. Happy path GET:
   suite with one test case — GET /users → 200 with { data: [{ id: 1 }] }
   assertions: statusCode 200, "$.data" exists, "$.data" isNotEmpty
   → test passes

2. Extraction + use in next step:
   step 1: POST /auth → 200, extract token from "$.access_token" scope "case"
   step 2: GET /profile with Authorization: "Bearer {{token}}" → 200
   → both steps pass, token correctly interpolated

3. Assertion failure:
   GET /users → 200 but response body is { data: [] }
   assertion: "$.data" isNotEmpty
   → test fails with AssertionError, softErrors correctly empty

4. warn validation:
   assertion with validation "warn" that fails
   → test passes, Playwright annotation contains the warning

5. Handler:
   step uses a handler that reads body.total and asserts > 0 using ctx.store and throw
   → passes when total > 0, fails when total === 0

6. disabled step:
   step with disabled: true in the middle of a case
   → skipped, subsequent steps still run

7. wait:
   step with wait: 500
   → at least 500ms elapsed before next step (assert with timestamps)

All E2E tests pass with npx vitest run (or playwright test if using playwright runner directly).
No regressions on any unit tests.
```

---

## Test pyramid summary

| Layer       | When       | Tool                  | Coverage target                                |
| ----------- | ---------- | --------------------- | ---------------------------------------------- |
| Unit        | Phases 2–5 | vitest                | Every function, every branch, every error path |
| Integration | Phase 3    | vitest                | Resolver + store + generators end-to-end       |
| E2E         | Phase 6    | vitest + local server | Full step execution pipeline                   |

Run `npx vitest run` at the end of every phase. No phase ships with a failing test.

---

## Dependency graph

```
Phase 1 (types + errors)
    ↓
Phase 2 (variable store + resolver)          ← depends on: types, errors
    ↓
Phase 3 (generators)                         ← depends on: types, errors, resolver, store
    ↓
Phase 4 (project loader + http executor)     ← depends on: types, errors, generators
    ↓
Phase 5 (assertion + extraction + handlers)  ← depends on: types, errors, store
    ↓
Phase 6 (test runner + CLI)                  ← depends on: everything
```

Each phase only imports from phases above it. No circular dependencies.

# plyson Architecture

`plyson` is a declarative API testing framework built on top of Playwright. Test authors write JSON — the framework handles discovery, resolution, execution, assertion, and reporting.

---

## High-level overview

```
JSON definitions
      │
      ▼
┌─────────────────┐
│   CLI (plyson) │  ← parses flags, selects env, boots runner
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Project Loader │  ← discovers & validates all files
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Variable Store │  ← builds the scoped variable registry
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Test Runner    │  ← drives Playwright, executes suites/cases/steps
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────────┐
│Resolver│ │ HTTP Executor│
└────────┘ └──────┬───────┘
                  │
         ┌────────┴────────┐
         ▼                 ▼
  ┌────────────┐   ┌───────────────┐
  │ Assertions │   │  Extraction   │
  └────────────┘   └───────┬───────┘
                           │
                           ▼
                   ┌───────────────┐
                   │ Variable Store│  ← write-back (case/suite/global scope)
                   └───────────────┘
```

---

## Components

### 1. CLI

Entry point for all user interaction. Responsibilities:

- Parses flags (`--env`, `--grep`, `--workers`, etc.)
- Validates that a matching `*.env.json` exists for the selected environment
- Passes native Playwright flags through unchanged to `playwright test`
- Injects `plyson`-specific config (env variables, project root) into the Playwright context before test discovery begins

The CLI does not execute tests directly — it boots the runner and hands off control to Playwright.

---

### 2. Project Loader

Runs once at startup before any test executes. Responsibilities:

- Walks the project directory and collects all typed files:

  | Pattern                       | Type                   |
  | ----------------------------- | ---------------------- |
  | `project.json`                | `Project`              |
  | `variables.json`              | `Variables`            |
  | `environments/*.env.json`     | `EnvironmentVariables` |
  | `environments/*.env`          | Dotenv overrides       |
  | `schemas/*.schema.json`       | JSON Schema            |
  | `handlers/*.handler.ts`       | Handler functions      |
  | `actions/*.action.ts`        | Custom action functions |
  | `scripts/*.script.json`       | `Testcase`             |
  | `suites/**/*.test.json`       | `TestSuite`            |

- Supports merging multiple environment files (JSON + Dotenv) and system environment variable overrides.
- Validates all files against their types — load errors surface before any test runs
- Resolves all `ref` values to their target `Testcase` — an unknown `ref` is a load error, not a runtime failure
- Enforces `id` uniqueness across `scripts/` and `suites/` combined
- Produces a fully resolved **Project Graph** that the Test Runner consumes

---

### 3. Variable Store

The central registry for all data used during execution. Maintains four named scopes and resolves them in priority order:

```
case  →  suite  →  environment  →  global
 (highest priority)              (lowest priority)
```

**Initialisation order:**

1. Load `variables.json` into the `global` scope
2. Load the selected `*.env.json → variables` into the `environment` scope
3. When a suite starts: load `TestSuite.variables` into the `suite` scope
4. When a case starts: load `Testcase.variables` into the `case` scope — `$gen` objects in this block are resolved once here and stay static for the lifetime of the case

**Write-back (extraction):**

After each step, extracted values from `response.extract` are written back into the store at the specified scope:

- `"scope": "case"` — available only within the current test case
- `"scope": "suite"` — available to all remaining cases in the same suite
- `"scope": "global"` — available everywhere for the rest of the run

**Reserved globals** (always available, no definition needed):

| Token            | Resolves to                |
| ---------------- | -------------------------- |
| `{{$timestamp}}` | `Date.now()` — Unix ms     |
| `{{$isoDate}}`   | `new Date().toISOString()` |
| `{{$guid}}`      | Fresh UUID v4 via Faker.js |

**Undefined variable behaviour:**

If a `{{token}}` references a name not present in any scope, the runner throws a resolution error and fails the step before the request is sent. Silent empty-string substitution is intentionally avoided — a missing variable is always a configuration mistake.

---

### 4. Resolver

Transforms raw JSON definitions into executable data immediately before use. Runs in two phases with different timing and semantics.

#### Phase 1 — Variable resolution (pre-case)

Triggered once when a test case starts, against the `variables` block only.

- Walks the object recursively
- Replaces `{{token}}` strings with values from the Variable Store
- Executes `$gen` objects and stores the result back into the `case` scope

Result: `$gen` values in `variables` are generated once and reused across all steps in the case. Use this when the same random value (e.g. a generated email address) must be consistent across multiple steps.

#### Phase 2 — Step resolution (pre-request)

Triggered immediately before each HTTP request, against the full `request` object (endpoint, path params, query params, headers, payload).

- Same recursive walk and `{{token}}` replacement
- `$gen` objects here generate **fresh values every time** — including on retries

Result: use `$gen` directly in the `request` payload when you need a unique value per execution (e.g. idempotency keys, trace IDs, per-request timestamps).

#### Resolution rules

- **Type preservation**: a string consisting of exactly one token — `"{{age}}"` — returns the stored value's original type (number, boolean, etc.), not a string. Mixed strings like `"user_{{id}}"` always return a string.
- **Nested resolution**: `$gen` options are themselves resolved before the generator runs, allowing constructs like `{ "$gen": "string", "length": { "$gen": "number", "min": 4, "max": 12 } }`.
- **Assertion values**: `value` fields in assertions are resolved in Phase 2 — `"value": "{{userId}}"` works as expected.
- **Path fields**: `path` fields in assertions and extractions are NOT resolved — they are treated as literal JSONPath/JMESPath expressions.

---

### 5. HTTP Executor

Wraps Playwright's `APIRequestContext`. Responsibilities:

- Prepends `baseUrl` from the active environment to the step's `endpoint`
- Applies `pathParams` substitution into the endpoint string before the request
- Sends the request using the resolved method, headers, query params, and payload
- Returns the raw `APIResponse` to the runner for assertion and extraction

**`autoFill` handling:**

When `autoFill` is configured, the executor fetches the named schema from `schemas/`, generates a payload from it respecting `includeFields` / `excludeFields`, then merges the step's explicit `payload` on top (explicit values win on key conflicts). The merged result is the final request body.

The AutoFill generator automatically resolves `$ref` pointers by looking up the target in the project's loaded schemas. It supports cross-schema references (e.g., `User.schema.json` referring to `Profile.schema.json`) and includes a recursion guard to handle circular schemas gracefully.

---

### 6. Assertion Engine

Runs after every HTTP response. Iterates `response.validations.assertions` in order.

**Execution order per step:**

1. Status code check (`validations.statusCode`) — always runs first
2. Response schema validation (`response.schema`) — if configured
3. Inline assertions (`validations.assertions`) — in the order declared
4. Handlers (`handlers`) — after all inline assertions

**Schema Validation:**

Response schemas are validated using AJV. At startup, the engine registers all schemas from the `schemas/` directory with AJV, using their filename (e.g., `User.schema.json`) as their unique identifier. This allows schemas to use relative `$ref` pointers to other schema files, which are automatically resolved by AJV during validation.

**Per assertion:**

1. Extract the value at `path` from `body` (via JSONPath or JMESPath) or `header`
2. Apply the `operator` against `value` using Playwright's `expect()` under the hood
3. On failure: if `validation: "warn"`, record a warning and continue; if `validation: "error"` (default), fail the step immediately

**JSONPath vs JMESPath detection:**

The engine detects the path syntax automatically — a path starting with `$` is treated as JSONPath, anything else as JMESPath. Both are supported in the same suite.

**Filter expressions in path:**

Filter expressions (e.g. `$.items[?(@.status=='disabled')]`) are fully supported and return an array of matched nodes. Combine with `isEmpty` / `isNotEmpty` / `hasLength` operators to assert on the filtered result.

---

### 7. Extraction Engine

Runs in parallel with the Assertion Engine after each response. Iterates `response.extract` in order.

For each entry:

1. Extract the value at `path` from `body` or `header`
2. Write the value into the Variable Store at the declared `scope`

Extracted values are immediately available to subsequent steps in the same case. `"scope": "global"` values are available to all remaining cases across all suites for the rest of the run.

---

### 8. Handler Runner

Runs after inline assertions and extractions. Iterates `handlers` in declaration order.

Each handler receives a `HandlerContext`:

```typescript
interface HandlerContext {
  request: ResolvedRequest // the fully resolved request that was sent
  response: APIResponse // raw Playwright APIResponse
  body: unknown // parsed response body (JSON)
  status: number // HTTP status code
  store: VariableStore // read/write access to the variable store
}
```

Handlers can:

- Perform custom assertions (throw to fail the step)
- Extract values and write them to the store via `store.set(name, value, scope)`
- Run arbitrary async logic

A handler that throws fails the step. Multiple handlers run in series — if one throws, subsequent handlers in the same step are skipped.

---

## Execution lifecycle

```
plyson run --env staging
      │
      ├─ CLI validates env, boots runner
      │
      ├─ Project Loader
      │     ├─ discovers all files
      │     ├─ validates types
      │     ├─ merges environments/*.env.json + *.env
      │     ├─ applies system environment variable overrides
      │     ├─ resolves all refs
      │     └─ produces Project Graph
      │
      ├─ Variable Store init
      │     ├─ load global variables.json
      │     └─ load staging.env.json variables
      │
      ├─ Project beforeAll steps   ← resolved & executed as regular steps
      │
      ├─ For each TestSuite
      │     ├─ push suite variables into store
      │     ├─ Suite beforeAll steps
      │     │
      │     ├─ For each Testcase
      │     │     ├─ push case variables into store (Phase 1 resolution)
      │     │     │
      │     │     └─ For each TestStep
      │     │           ├─ wait (if configured)
      │     │           ├─ IF ActionStep:
      │     │           │    └─ Action Runner (executes custom logic)
      │     │           ├─ ELSE IF HttpStep:
      │     │           │    ├─ Phase 2 resolution (request object)
      │     │           │    ├─ autoFill merge (if configured)
      │     │           │    ├─ HTTP Executor → APIResponse
      │     │           │    ├─ Status code check
      │     │           │    ├─ Schema validation (if configured)
      │     │           │    ├─ Assertion Engine
      │     │           │    ├─ Extraction Engine → store write-back
      │     │           │    └─ Handler Runner
      │     │
      │     └─ Suite afterAll steps
      │
      └─ Project afterAll steps
```

---

## Key design decisions

**JSON as the authoring surface, TypeScript only for escape hatches.**
Test authors never write TypeScript unless they need a handler. The JSON schema is expressive enough for the vast majority of API test scenarios.

**Refs are resolved at load time, not runtime.**
A broken `ref` surfaces immediately as a load error with a clear message — not as a cryptic runtime failure mid-run.

**Variable resolution is explicit and strict.**
Missing tokens throw rather than silently substituting empty strings. This prevents subtle bugs where a missing variable causes a wrong request to pass.

**`$gen` placement controls timing.**
Putting `$gen` in `variables` → resolved once, consistent across steps. Putting `$gen` in `request` → resolved fresh per step. This is a deliberate design choice, not a side effect.

**Assertion `validation: "warn"` enables incremental adoption.**
Schema drift assertions and non-critical field checks can be downgraded to warnings. This lets teams add coverage without blocking CI on every run.

**Handlers are the universal escape hatch.**
Any logic that can't be expressed declaratively — cross-field assertions, conditional extraction, computed values — goes in a handler. Handlers have full access to the request, response, and variable store.

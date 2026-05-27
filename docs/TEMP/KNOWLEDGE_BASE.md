# plyson Knowledge Base

This document provides a comprehensive overview of the `plyson` testing framework, combining architectural conventions with technical type definitions.

---

## 1. Project Architecture & Structure

A `plyson` project follows a strict directory structure to enable auto-discovery and consistent test execution.

```
my-api-tests/
  ├── .github/               # CI/CD workflows
  ├── data/                  # External test data (CSV/JSON - Future Scope)
  ├── environments/          # *.env.json: Environment-specific configurations
  ├── handlers/              # *.handler.ts: Custom validation/extraction logic
  ├── schemas/               # *.schema.json: Managed API schemas for auto-fill
  ├── scripts/               # *.script.json: Reusable standalone test cases
  ├── suites/                # *.test.json: Organized test suites (recursive)
  ├── project.json           # Global project metadata and hooks
  ├── variables.json         # Global variables (lowest priority)
  ├── playwright.config.ts   # Playwright configuration extension
  └── package.json           # Project dependencies
```

---

## 2. Global Configuration

### `project.json`

The entry point for the runner. Defines metadata and global lifecycle hooks.

- **Type**: `Project`
- **Hooks**: `beforeAll`, `afterAll` (global scope).

### `variables.json`

Defines global variables available across the entire project.

- **Type**: `Variables` (`Record<string, any>`)
- **Priority**: Lowest (overridden by environment, suite, and case variables).

### `playwright.config.ts`

Extends `plyson/playwright.config.base`. Users should only override specific Playwright settings like `workers` or `reporter`.

---

## 3. Environment Management (`environments/`)

**Convention**: `environments/*.env.json`
Selected via `--env <name>` flag (e.g., `--env dev` loads `dev.env.json`).

- **Type**: `EnvironmentVariables`
- **Properties**:
  - `baseUrl`: Required. Base URL for all requests.
  - `specUrl`: Optional. OpenAPI/Swagger URL for schema syncing.
  - `variables`: Environment-specific overrides.

---

## 4. Schemas & Auto-fill (`schemas/`)

**Convention**: `schemas/*.schema.json`
Managed by `plyson sync-schemas`. Used for response validation and request payload auto-filling.

### Auto-fill Logic

Helps automatically populate request payloads from schemas.

- **Type**: `AutoFillType`
- **Fields**: `includeFields`, `excludeFields`.
- **Behavior**: Functions like a JS spread operator; explicit `payload` values override auto-filled values.

---

## 5. Custom Logic Handlers (`handlers/`)

**Convention**: `handlers/*.handler.ts`
TypeScript files exporting a `run` function for complex logic.

- **Reference**: Used in `TestStep.handlers` by filename stem.
- **Context**: Receives `response`, `body`, `status`, and `store`.
- **Execution**: Runs after inline assertions and extractions.

---

## 6. Reusable Scripts (`scripts/`)

**Convention**: `scripts/*.script.json`
Standalone `Testcase` objects that can be referenced via `ref`.

- **ID**: Referenced by the `id` field inside the file, not the filename.
- **Uniqueness**: IDs must be unique project-wide.

---

## 7. Test Suites (`suites/`)

**Convention**: `suites/**/*.test.json` (Recursive discovery)
A `TestSuite` contains multiple `Testcase` objects.

- **Features**: Suite-level `variables`, `tags`, and `beforeAll`/`afterAll` hooks.
- **Disabling**: `disabled: true` at suite level skips all contained cases.

---

## 8. Variables & Scoping

### Resolution Order (Highest to Lowest)

1.  **Case Variables** (defined in `Testcase`)
2.  **Suite Variables** (defined in `TestSuite`)
3.  **Environment Variables** (`environments/*.env.json`)
4.  **Global Variables** (`variables.json`)

### Extraction Scope

Extracted values from responses can be stored at three levels:

- `"case"`: Current test case only.
- `"suite"`: All cases within the same suite.
- `"global"`: Persistent for the remainder of the test run.

---

## 9. Technical Reference (Type Definitions)

### Network & Assertions

- **HTTP Methods**: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`.
- **Assertion Operators**: Supports existence (`exists`), equality (`isEquals`), type checks (`isArray`, `isString`), numeric comparisons (`isGreaterThan`), regex (`regexPattern`), and length checks.

### Request (`Req`)

```ts
{
  method: HTTPMethod;
  endpoint: string;
  queryParams?: Record<string, any>;
  pathParams?: Record<string, any>;
  headers?: Record<string, any>;
  autoFill?: AutoFillType;
  payload?: Record<string, any>;
}
```

### Response (`Res`)

```ts
{
  schema?: { name: string; validation?: boolean | "warn" };
  validations: {
    statusCode: number | number[];
    assertions?: Assertions[];
  };
  extract?: ExtractedValue[];
}
```

### Test Step (`TestStep`)

Can be **Inline** (full definition) or **Referenced** (`ref` to a script).

- **Inline Properties**: `title`, `description`, `disabled`, `wait`, `flags`, `handlers`, `request`, `response`.

### Test Case (`Testcase`)

```ts
{
  id: string;
  title: string;
  description?: string;
  disabled?: boolean;
  testType?: "positive" | "negative";
  variables?: Variables;
  tags: string[];
  steps: TestStep[];
}
```

### Test Suite (`TestSuite`)

```ts
{
  title: string;
  description?: string;
  disabled?: boolean;
  tags: string[];
  variables?: Variables;
  beforeAll?: TestStep[];
  afterAll?: TestStep[];
  testCases: Testcase[];
}
```

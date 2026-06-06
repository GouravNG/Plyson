## Project Structure

```
my-api-tests/
  .github/                        # CI workflows
  data/                           # External test data (future scope)
  environments/                   # Environment config files
  handlers/                       # Custom validation / extraction handlers
  actions/                        # Custom standalone test actions
  schemas/                        # API schemas (managed by plyson sync-schemas)
  scripts/                        # Reusable standalone test cases
  suites/                         # Test suites
  project.json                    # Project root config
  variables.json                  # Global variables
  playwright.config.ts            # Playwright config — extends plyson base
  package.json
```

---

## Root Files

### `project.json`

**Exact filename. Required. One per project.**

The entry point the runner loads first. Defines project-level metadata and
global lifecycle hooks that run before and after the entire test run.

```json
{
  "title": "My API Tests",
  "description": "End-to-end API test suite",
  "version": "1.0.0",
  "beforeAll": [],
  "afterAll": []
}
```

Maps to the `Project` type.

---

### `variables.json`

**Exact filename. Optional. One per project.**

Global variables available to every suite, case, and script across the
entire project. Lowest priority in the variable scope chain — overridden
by environment, suite, and case variables.

```json
{
  "DEFAULT_TIMEOUT": 5000,
  "PAGE_SIZE": 20
}
```

Maps to the `Variables` type.

---

### `playwright.config.ts`

**Exact filename. Required. One per project.**

Extends the base config provided by the plyson library. Users only override
what they need — workers, reporter, etc. The `testMatch` and `globalSetup`
are handled by the base config and should not be changed.

```ts
import { defineConfig } from '@playwright/test'
import base from 'plyson/playwright.config.base'

export default defineConfig({
  ...base,
  workers: 4,
  reporter: [['html'], ['list']],
})
```

---

## `environments/`

**Convention: `*.env.json` and/or `*.env`**
**Example: `dev.env.json`, `dev.env`, `staging.env.json`**

One or more files per environment. Selected at runtime via the `--env` flag:

```bash
plyson run --env staging
```

The filename stem (e.g. `staging` from `staging.env.json` or `staging.env`) is the environment name passed to `--env`.

### Merging and Priority

Variables and configuration are merged from multiple sources in this order (highest priority wins):

1.  **System Environment Variables** (CI/CD overrides)
2.  **Dotenv File** (`*.env`)
3.  **JSON File** (`*.env.json`)
4.  **Global Variables** (`variables.json`)

### JSON Format (`*.env.json`)

```json
{
  "baseUrl": "https://api.staging.example.com",
  "specUrl": "https://api.staging.example.com/openapi.json",
  "variables": {
    "CLIENT_ID": "staging-client-123",
    "CLIENT_SECRET": "{{SECRET}}"
  }
}
```

Maps to the `EnvironmentVariables` type.

### Dotenv Format (`*.env`)

```sh
baseUrl=https://api.staging.env
CLIENT_ID=staging-env-override
DB_PASS=secret
```

- `baseUrl` or `BASE_URL` — overrides the base URL.
- `specUrl` or `SPEC_URL` — overrides the spec URL.
- Other keys become environment variables.

### System Overrides

Any variable or `baseUrl` can be overridden by system environment variables:

```bash
BASE_URL=https://ci.test.com DB_PASS=ci-secret npx plyson run --env dev
```

---

## `schemas/`

**Convention: `*.schema.json`**
**Example: `user.schema.json`, `order.schema.json`**

Stores API request and response schemas downloaded from the spec URL.
Referenced in test scripts by the filename stem:

```json
{
  "autoFill": {
    "schemaName": "user",
    "includeFields": ["name", "email", "role"]
  }
}
```

The above references `schemas/user.schema.json`.

### Managed by the CLI — do not edit manually.

```bash
# Download all schemas from the active environment's specUrl
plyson sync-schemas --env dev

# Detect and remove stale schema files no longer present in the spec
plyson sync-schemas --env dev --prune
```

`--prune` compares local `*.schema.json` files against the fetched spec and
removes any that no longer exist. Without `--prune`, stale files are reported
as warnings but not deleted.

Re-run `plyson sync-schemas` whenever the API spec changes.

> **Note:** You can choose to commit `schemas/` to version control (recommended
> for stability) or add it to `.gitignore` and treat it as a build artifact.

---

## `handlers/`

**Convention: `*.handler.ts`**
**Example: `assert-pagination.handler.ts`, `extract-cursor.handler.ts`**

TypeScript files that export custom functions for logic too complex for
inline assertions or extractions. Referenced in test steps by the filename stem:

```json
{
  "handlers": ["assert-pagination", "extract-cursor"]
}
```

A handler file receives the full response context and the current variable store:

```ts
// assert-pagination.handler.ts
import type { HandlerContext } from '@plyson/test'

export async function run({ response, body, status, store }: HandlerContext) {
  const { total, page, limit, items } = body
  if (items.length > limit) {
    throw new Error(`items.length (${items.length}) exceeds limit (${limit})`)
  }
}
```

- Multiple handlers can be specified per step — they run in the order listed.
- The exported function name must be `run`.
- Handlers run after all inline assertions and extractions.

---

## `scripts/`

**Convention: `*.script.json`**
**Example: `create-user.script.json`, `authenticate.script.json`**

Standalone reusable test cases that can be referenced from any test case's
`steps` array via a `ref`. Each file is a full `Testcase` object.

```json
{
  "id": "authenticate",
  "title": "Authenticate and extract token",
  "tags": [],
  "steps": [
    {
      "title": "POST /auth/token",
      "request": {
        "method": "POST",
        "endpoint": "/auth/token",
        "payload": {
          "clientId": "{{CLIENT_ID}}",
          "secret": "{{CLIENT_SECRET}}"
        }
      },
      "response": {
        "validations": { "statusCode": 200 },
        "extract": [
          {
            "name": "token",
            "from": "body",
            "path": "$.access_token",
            "scope": "global"
          }
        ]
      }
    }
  ]
}
```

Referenced from any test case:

```json
{
  "steps": [
    { "ref": "authenticate" },
    { "ref": "create-user" },
    {
      "title": "GET /orders",
      "request": { "method": "GET", "endpoint": "/orders" },
      "response": { "validations": { "statusCode": 200 } }
    }
  ]
}
```

### Rules

- The `id` field inside the file is what `ref` points to — not the filename.
- `id` values must be **unique across the entire project** — no collisions
  between `scripts/` and `suites/` test cases.
- The runner validates all `ref` values at load time. A `ref` pointing to an
  unknown `id` is a load error, not a runtime failure.

---

## `suites/`

**Convention: `*.test.json` anywhere inside the `suites/` folder.**
**Example: `suites/users.test.json`, `suites/payments/orders.test.json`**

Any file matching `*.test.json` found anywhere under `suites/` (including
subfolders) is auto-discovered as a test suite. Folder structure is entirely
up to the user — organise by domain, version, or any other grouping.

```
suites/
  users.test.json
  payments/
    orders.test.json
    refunds.test.json
  auth/
    login.test.json
```

Each `*.test.json` file is a full `TestSuite` object:

```json
{
  "title": "User API",
  "description": "Tests for the /users resource",
  "disabled": false,
  "tags": ["smoke", "users"],
  "variables": {
    "DEFAULT_ROLE": "viewer"
  },
  "beforeAll": [{ "ref": "authenticate" }],
  "afterAll": [],
  "testCases": [
    {
      "id": "get-user",
      "title": "GET /users/:id returns the user",
      "testType": "positive",
      "tags": ["smoke"],
      "steps": [
        {
          "title": "GET /users/{{userId}}",
          "request": {
            "method": "GET",
            "endpoint": "/users/{{userId}}"
          },
          "response": {
            "validations": {
              "statusCode": 200,
              "assertions": [
                {
                  "title": "id matches",
                  "from": "body",
                  "path": "$.id",
                  "operator": "isEquals",
                  "value": "{{userId}}"
                }
              ]
            }
          }
        }
      ]
    }
  ]
}
```

Maps to the `TestSuite` type. Test cases inside are `Testcase` objects.

### Rules

- Suite files can be nested at any depth inside `suites/` — the runner walks
  the directory recursively.
- `testCases[].id` must be unique across the entire project (same pool as
  `scripts/*.script.json` ids).
- `disabled: true` on a suite skips all test cases within it.

---

## `data/`

**Convention: anything — future scope.**

Reserved for external test data files (CSV, JSON arrays) for data-driven
testing. Currently no naming convention is enforced. Full support will be
added in a future release.

---

## Variable Scope Chain

Variables are resolved in this order — highest priority wins:

```
case variables
  ↓ overrides
suite variables
  ↓ overrides
environment variables  (environments/*.env.json → variables)
  ↓ overrides
global variables       (variables.json)
```

Extracted values from `response.extract` are written back into the store
at the specified `scope`:

- `"scope": "case"` — available only within the current test case
- `"scope": "suite"` — available to all test cases in the same suite
- `"scope": "global"` — available everywhere for the rest of the run

---

## Quick Reference

| File / Pattern            | Type                   | Discovered by                     |
| ------------------------- | ---------------------- | --------------------------------- |
| `project.json`            | `Project`              | exact filename                    |
| `variables.json`          | `Variables`            | exact filename                    |
| `environments/*.env.json` | `EnvironmentVariables` | `*.env.json` pattern              |
| `schemas/*.schema.json`   | JSON Schema            | `*.schema.json` pattern           |
| `handlers/*.handler.ts`   | handler function       | `*.handler.ts` pattern            |
| `actions/*.action.ts`     | custom action          | `*.action.ts` pattern             |
| `scripts/*.script.json`   | `Testcase`             | `*.script.json` pattern           |
| `suites/**/*.test.json`   | `TestSuite`            | `*.test.json` pattern (recursive) |
| `data/`                   | anything               | future scope                      |

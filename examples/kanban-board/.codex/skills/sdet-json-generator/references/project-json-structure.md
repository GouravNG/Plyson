# project.json Structure Reference

This reference explains how to structure `project.json` to define and reuse global testcases across multiple test suites.

---

## Overview

The `project.json` file serves as the **test project configuration** that:

- Defines global testcases (e.g., authentication flows) that are reused across suites
- Specifies environment defaults
- Lists setup/teardown flows that run before all testcases

---

## Full Structure

```json
{
  "$schema": "./node_modules/@plyson/test/src/schemas/project.schema.json",
  "title": "Project Title",
  "description": "Project description",
  "version": "1.0.0",
  "defaultEnv": "local",
  "beforeAll": [{ "ref": "TC_ADMIN_AUTH" }, { "ref": "TC_USER_AUTH" }],
  "variables": {
    "baseUrl": "http://localhost:3000",
    "adminEmail": "admin@example.com"
  }
}
```

---

## Key Fields

### `title` (required)

Human-readable project name.

**Example:**

```json
"title": "Marketplace API Validation"
```

### `description` (optional)

Project purpose and scope.

**Example:**

```json
"description": "Comprehensive API testing for the marketplace platform"
```

### `version` (optional)

Semantic version for tracking test suite releases.

**Example:**

```json
"version": "1.0.0"
```

### `defaultEnv` (optional)

Default environment to run tests against (usually defined in `environments/<env>.env.json`).

**Example:**

```json
"defaultEnv": "local"
```

**Typical environments:**

- `local` — Local development server
- `staging` — Staging environment
- `production` — Production environment

---

### `beforeAll` (optional)

Array of testcases or inline steps to execute **before all testcases** in any suite that includes this project.

#### Using References

Reference a global testcase by ID:

```json
"beforeAll": [
  { "ref": "TC_ADMIN_AUTH" },
  { "ref": "TC_USER_AUTH" }
]
```

**Usage:**

- Pre-authenticate users/admins before running tests
- Set up shared data (create categories, products, etc.)
- Verify service health

**Important:** The referenced testcase IDs (e.g., `TC_ADMIN_AUTH`) must exist in one of your test suite files (typically in a `Setup.testsuite.json` or global test suite).

#### Finding Global Testcase IDs

1. Search for `TC_*` IDs in your test suite files
2. Look in suites that contain setup/auth flows
3. Example files:
   - `suites/Auth.testsuite.json` — Contains `TC_ADMIN_AUTH`, `TC_USER_AUTH`
   - `suites/Setup.testsuite.json` — Contains `TC_SETUP_*` testcases

#### Example: Auth Setup Flow

In `suites/Auth.testsuite.json`:

```json
{
  "title": "Authentication Setup",
  "tags": ["setup", "auth"],
  "testCases": [
    {
      "id": "TC_ADMIN_AUTH",
      "title": "Authenticate as Admin",
      "testType": "positive",
      "tags": ["setup", "authentication"],
      "steps": [
        {
          "title": "Login with admin credentials",
          "request": {
            "method": "POST",
            "endpoint": "/auth/login",
            "payload": {
              "email": "admin@example.com",
              "password": "AdminPassword123"
            }
          },
          "response": {
            "validations": { "statusCode": 200 },
            "extract": [
              {
                "name": "adminToken",
                "from": "body",
                "path": "$.token",
                "scope": "global"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

Then reference it in `project.json`:

```json
{
  "beforeAll": [{ "ref": "TC_ADMIN_AUTH" }]
}
```

---

### `variables` (optional)

Global variables available to all testcases. These can be:

- Environment-specific values (URLs, credentials)
- Feature flags
- Shared test data

**Example:**

```json
"variables": {
  "baseUrl": "http://localhost:3000",
  "adminEmail": "admin@example.com",
  "testTimeout": 5000
}
```

**Usage in testcases:**

```json
{
  "request": {
    "endpoint": "/api/products"
  },
  "response": {
    "assertions": [
      {
        "title": "Response time is within limits",
        "from": "header",
        "path": "response-time",
        "operator": "isLessThan",
        "value": 5000
      }
    ]
  }
}
```

---

## Common Patterns

### Pattern 1: Auth-First Execution

Always authenticate before running any tests:

```json
{
  "title": "Marketplace API",
  "defaultEnv": "local",
  "beforeAll": [{ "ref": "TC_ADMIN_AUTH" }, { "ref": "TC_USER_AUTH" }]
}
```

This ensures both an admin and user token are available globally before any test suite runs.

### Pattern 2: Data Setup Flow

Initialize test data before running feature tests:

```json
{
  "beforeAll": [
    { "ref": "TC_ADMIN_AUTH" },
    { "ref": "TC_SETUP_CATEGORIES" },
    { "ref": "TC_SETUP_PRODUCTS" }
  ]
}
```

**Execution order:**

1. Admin authentication (token saved to `adminToken` variable)
2. Create test categories
3. Create test products

### Pattern 3: Minimal Setup (No Global Preconditions)

If tests are independent:

```json
{
  "title": "Marketplace API",
  "defaultEnv": "local"
}
```

(No `beforeAll` array needed.)

---

## Integration with Test Suite Files

### Flow: project.json → Test Suite → Testcases

```
project.json
├─ defaultEnv: "local"
├─ beforeAll: [TC_ADMIN_AUTH, TC_USER_AUTH]
│
├── suites/Auth.testsuite.json
│   ├─ title: "Authentication Tests"
│   ├─ beforeAll: [] (optional, overrides project-level)
│   └─ testCases: [TC_ADMIN_AUTH, TC_USER_AUTH, ...]
│
├── suites/Products.testsuite.json
│   ├─ title: "Product Tests"
│   ├─ beforeAll: [] (inherits from project if not specified)
│   └─ testCases: [TC_PRODUCT_001, TC_PRODUCT_002, ...]
│
└── environments/local.env.json
    ├─ baseUrl: "http://localhost:3000"
    └─ other env-specific config
```

### Execution Order

1. **Load project.json** — Extract `beforeAll` and `variables`
2. **Run project-level beforeAll** — Execute `TC_ADMIN_AUTH`, `TC_USER_AUTH`
3. **For each test suite:**
   - Load suite-level `beforeAll` (if defined)
   - Run testcases
4. **Optional: Run afterAll** — Cleanup steps (if defined)

---

## Real Example: Marketplace Project

### project.json

```json
{
  "$schema": "./node_modules/@plyson/test/src/schemas/project.schema.json",
  "title": "Marketplace API Validation",
  "description": "API testing project for marketplace platform",
  "version": "1.0.0",
  "defaultEnv": "local",
  "beforeAll": [
    {
      "ref": "TC_ADMIN_AUTH"
    },
    {
      "ref": "TC_USER_AUTH"
    }
  ],
  "variables": {
    "baseUrl": "http://localhost:3000",
    "adminEmail": "admin@example.com",
    "regularUserEmail": "user@example.com"
  }
}
```

### suites/Auth.testsuite.json

```json
{
  "title": "Authentication Tests",
  "tags": ["authentication", "critical"],
  "testCases": [
    {
      "id": "TC_ADMIN_AUTH",
      "title": "Admin login successful",
      "tags": ["setup", "positive"],
      "steps": [
        {
          "title": "POST /auth/login with admin credentials",
          "request": {
            "method": "POST",
            "endpoint": "/auth/login",
            "payload": {
              "email": "admin@example.com",
              "password": "AdminPass123"
            }
          },
          "response": {
            "validations": { "statusCode": 200 },
            "extract": [
              {
                "name": "adminToken",
                "from": "body",
                "path": "$.token",
                "scope": "global"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "TC_USER_AUTH",
      "title": "User login successful",
      "tags": ["setup", "positive"],
      "steps": [
        {
          "title": "POST /auth/login with user credentials",
          "request": {
            "method": "POST",
            "endpoint": "/auth/login",
            "payload": {
              "email": "user@example.com",
              "password": "UserPass123"
            }
          },
          "response": {
            "validations": { "statusCode": 200 },
            "extract": [
              {
                "name": "userToken",
                "from": "body",
                "path": "$.token",
                "scope": "global"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### suites/Products.testsuite.json

```json
{
  "title": "Product Management Tests",
  "tags": ["products"],
  "testCases": [
    {
      "id": "TC_PRODUCT_001",
      "title": "Admin can create product",
      "testType": "positive",
      "tags": ["products", "admin"],
      "steps": [
        {
          "title": "POST /products with admin token",
          "request": {
            "method": "POST",
            "endpoint": "/products",
            "headers": {
              "Authorization": "Bearer {{adminToken}}"
            },
            "payload": {
              "name": "Test Product",
              "price": 99.99,
              "category": "electronics"
            }
          },
          "response": {
            "validations": { "statusCode": 201 }
          }
        }
      ]
    }
  ]
}
```

### Execution Flow

1. **Load project.json** → Extract `beforeAll: [TC_ADMIN_AUTH, TC_USER_AUTH]`
2. **Run project beforeAll:**
   - Execute `TC_ADMIN_AUTH` → Extract and save `adminToken` globally
   - Execute `TC_USER_AUTH` → Extract and save `userToken` globally
3. **Run test suites:**
   - Run `suites/Auth.testsuite.json` tests
   - Run `suites/Products.testsuite.json` tests
   - In `TC_PRODUCT_001`, use `{{adminToken}}` from global scope

---

## When to Use project.json vs. Suite-Level beforeAll

| Scenario                            | Use project.json beforeAll | Use suite-level beforeAll |
| ----------------------------------- | -------------------------- | ------------------------- |
| All test suites need auth           | ✓                          |                           |
| Only one suite needs auth           |                            | ✓                         |
| Common setup for all tests          | ✓                          |                           |
| Suite-specific setup                |                            | ✓                         |
| Extract data reused across suites   | ✓                          |                           |
| Extract data used only in one suite |                            | ✓                         |

---

## Debugging & Validation

### Check if project.json is valid

1. Verify `$schema` path is correct
2. Ensure all referenced testcase IDs exist in your test suite files
3. Run schema validation:
   ```
   pnpm validate project.json
   ```

### Verify beforeAll References

Search your test suite files for the referenced IDs:

```bash
# Example: Find TC_ADMIN_AUTH definition
grep -r "TC_ADMIN_AUTH" suites/
```

If not found, create the testcase in the appropriate suite or remove the reference.

---

## Key Takeaways

✓ Use `project.json beforeAll` for reusable global flows (auth, data setup)
✓ Reference testcases by ID using `{ "ref": "TC_ID" }`
✓ Extracted variables (via `"scope": "global"`) are available to all downstream tests
✓ Keep `beforeAll` minimal — only include truly global prerequisites
✓ Document which testcase IDs provide which global data (tokens, IDs, etc.)

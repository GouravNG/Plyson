# Phase 6 Summary — Test Runner & E2E Verification

## Goal

Implement the core execution pipeline, wiring together all previous components (Project Loader, Resolver, HTTP Executor, Assertion/Extraction Engines) into a unified `TestRunner`. The framework is now capable of running end-to-end declarative API tests via Playwright.

## Deliverables

### 1. Test Runner (`src/core/test-runner.ts`)

- **`registerSuites`**: Programmatically registers `TestSuite` objects as Playwright `test.describe` and `test` blocks.
- **`runSteps`**: Implements the full execution lifecycle for `TestStep` sequences:
  - Step-level delays (`wait`).
  - Phase 2 variable resolution (fresh per step).
  - HTTP execution via `HttpExecutor`.
  - Status code validation.
  - JSON Schema validation.
  - Inline assertion execution.
  - Variable extraction and store write-back.
  - Custom handler execution.
  - Soft error reporting via Playwright annotations.

### 2. Core Utilities

- **`safeParseJson` (`src/utils/safe-parse-json.ts`)**: Robust response parsing that degrades gracefully to text if JSON parsing fails or the content-type is unexpected.
- **`sleep` (`src/utils/sleep.ts`)**: Simple promise-based delay utility.

### 3. ESM Transition

- Updated `package.json` to `"type": "module"`.
- Adjusted `ProjectLoader` for ESM-compatible dynamic imports using `pathToFileURL`.
- Enabled top-level await in test files.

### 4. E2E Testing Infrastructure

- **Mock Server (`src/__tests__/e2e/mock-server.ts`)**: A lightweight Node.js HTTP server to simulate real API behavior for testing.
- **E2E Project Fixture (`src/__tests__/fixtures/e2e-project/`)**: A complete sample project with suites, environment variables, and test cases.
- **Full Run Test (`src/__tests__/e2e/full-run.test.ts`)**: A Playwright test file that boots the mock server, loads the E2E project, and registers the suites for execution.

## Verification Results

### Unit Tests (Vitest)

- Total Files: 11
- Total Passed: 74
- Coverage: Core engines (Assertion, Extraction, Resolver, Store, Generators) fully verified.

### E2E Tests (Playwright)

- **Scenario 1: Happy path GET** - Verified status code 200 and body assertions on a collection.
- **Scenario 2: Extraction & Interpolation** - Verified POST auth flow, token extraction to `case` scope, and subsequent GET using the token in headers.

## Usage

To run the E2E tests:

```bash
npm run test:e2e
```

To run the unit tests:

```bash
npm test
```

## Next Steps (Phase 7)

- Implement the CLI commands (`run`, `validate`, `generate`, etc.) using `commander`.
- Wire `plyson run` to trigger the Playwright execution.

# Console Logger for Test Runs

## Summary

Add a first-version console logger that prints
readable run progress, warnings, and errors during
Playwright execution using the test case id as the
log context.

Target format:

INFO [test-case-id] -> Running testcase test-case-id
INFO [test-case-id] -> Executing step 1: Step title
WARN [test-case-id] -> Warning title: warning details
ERROR [test-case-id] -> ErrorName: error message

Errors should include stack/details when available,
then still be rethrown so Playwright failure behavior
remains unchanged.

## Key Changes

- Add a small logger module, likely src/core/
  logger.ts, with:
  - LogLevel = 'info' | 'warn' | 'error'
  - Logger interface with info, warn, and error
  - ConsoleLogger implementation using console.log,
    console.warn, and console.error
  - error formatting helper that handles Error,
    arrays/objects such as AJV errors, and unknown
    values
- Update registerSuites to create/use the default
  ConsoleLogger.
- When each testcase starts, log:
  - INFO [id] -> Running testcase <id>
- Update runSteps to accept a run context containing
  testCaseId and logger.
- For each non-disabled resolved step, log:
  - INFO [id] -> Executing step <number>: <step
    title>
- When soft warnings are collected from schema
  validation, warn assertions, or handler ctx.warn,
  log each as:
  - WARN [id] -> <soft.title>: <formatted
    soft.error>
- On thrown errors during a testcase or step, log:
  - ERROR [id] -> <formatted error with stack/
    details>
  - then rethrow the original error.
- No file logging or JSON-lines mode.
- Optionally allow registerSuites(graph, store,
  logger = new ConsoleLogger()) so tests can inject a
  fake logger without changing normal usage.

## Test Plan

- Add focused Vitest tests for logger formatting:
  - info line includes [test-case-id] ->
  - warn formats Error, string, array/object
    details
  - error includes stack when present
- Add runner-level tests with a fake logger where
  practical:
  - testcase start is logged with id
  - step execution logs step 1, step 2
  - soft warning logs through logger and still
    creates Playwright annotation
  - thrown assertion/status/handler error logs once
    and is rethrown
- Run:
  - npm test
  - npm run build

## Assumptions

- First implementation is console-only and human-
  readable.
- No timestamps for now, to keep output stable and
  tests deterministic.
- Before/after hooks are not logged with testcase ids
  unless they fail inside a testcase context; this
  version focuses on testcase execution as requested.

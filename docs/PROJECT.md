This project is playson: a TypeScript framework for writing
API tests as JSON, then running them through Playwright.

Big Picture

Users write files like:

- project.json: project metadata and global hooks
- variables.json: global variables
- environments/dev.env.json: base URL and env-specific
  variables
- schemas/\*.schema.json: request/response JSON schemas
- scripts/\*.script.json: reusable test cases
- suites/\*_/_.test.json: actual API test suites
- handlers/\*.handler.ts: custom TypeScript escape hatches

The framework loads those files, resolves variables like
{{token}}, sends HTTP requests with Playwright, checks
assertions, extracts response values, and optionally runs
custom handlers.

Main Runtime Flow

The core flow is:

1. src/core/project-loader.ts
   Discovers and validates all project files. It loads project
   config, variables, environment files, schemas, handlers,
   scripts, and suites. It also expands ref steps by replacing
   them with reusable script steps.
2. src/core/variable-store.ts
   Stores variables in scoped layers:

   case > suite > environment > global

   It also supports reserved variables like {{$timestamp}},
   {{$isoDate}}, and {{$guid}}.

3. src/core/resolver.ts
   Resolves {{variables}} and $gen generator objects. Case
   variables are resolved once before the test case. Request
   data is resolved fresh before each step.
4. src/core/http-executor.ts
   Builds the final URL from baseUrl + endpoint, applies path
   params, headers, query params, and payloads, then calls
   Playwright’s APIRequestContext.fetch.
5. src/core/assertion-engine.ts
   Checks status codes, JSON schemas, and inline assertions
   such as equals, exists, isNotEmpty, hasLength, etc.
6. src/core/extraction-engine.ts
   Pulls values from response body or headers and writes them
   back into the variable store.
7. src/core/handler-runner.ts
   Runs custom TypeScript handlers after declarative
   assertions/extractions.
8. src/core/test-runner.ts
   Wires everything into Playwright test.describe and test
   blocks.

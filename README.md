# play-son

A declarative, JSON-driven API testing framework built on top of [Playwright](https://playwright.dev/).

## Features

- **Declarative Testing**: Write API tests in JSON format.
- **Variable Injection**: Easy variable management across global, environment, suite, and case scopes.
- **Dynamic Generators**: Built-in support for generating random data (dates, IDs, strings, etc.) using `@faker-js/faker`.
- **JSON Schema Validation**: Built-in validation for requests and responses.
- **Flexible Assertions**: Comprehensive set of assertions (equals, exists, length, etc.).
- **Response Extraction**: Extract values from responses to use in subsequent steps.
- **Custom Handlers**: TypeScript escape hatches for complex logic.
- **Playwright Integration**: Leverages Playwright's powerful `APIRequestContext` and reporting.

## Installation

```bash
npm install play-son
```

## Quick Start

1. Initialize a new project:

   ```bash
   npx playson init my-tests
   ```

2. Run your tests:
   ```bash
   npx playson run my-tests/suites/sample.test.json
   ```

## Documentation

For detailed information, please refer to the [docs](./docs) directory:

- [Architecture](./docs/ARCHITECTURE.md)
- [CLI Reference](./docs/CLI.md)
- [Assertions](./docs/ASSERTIONS.md)
- [Variable Management](./docs/KNOWLEDGE_BASE.md)

## License

MIT

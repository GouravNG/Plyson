# Plyson

A declarative, JSON-driven API testing framework built on top of [Playwright](https://playwright.dev/).

## Features

- **Declarative Testing**: Write API tests in pure JSON format.
- **IDE Intellisense**: Built-in JSON Schema support for autocompletion and validation in your IDE.
- **Dynamic Data**: Support for variables and random data generation (via Faker.js).
- **Playwright Powered**: Leverages Playwright's reliable HTTP execution and reporting.
- **Variable Scoping**: Manage variables across global, environment, suite, and case scopes.
- **Custom Handlers**: TypeScript escape hatches for complex logic.

## Quick Start

### 1. Install the CLI globally

```bash
npm install -g @plyson/cli
```

### 2. Initialize a new project

```bash
npx plyson init my-tests
cd my-tests
```

### 3. Sync Project Schemas

This step is crucial to enable **Intellisense** and autocompletion in your IDE while writing JSON tests.

```bash
npx plyson sync-project-schemas
```

### 4. Run your tests

Run all tests in your project against the default `dev` environment.

```bash
npx plyson run --env dev
```

## Documentation

For detailed information, please refer to our [Documentation Site](https://plyson.vercel.app):

- [Installation Guide](https://plyson.vercel.app/docs/test/getting-started/installation)

## License

MIT

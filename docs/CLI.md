# play-son CLI Design

This document outlines the command-line interface (CLI) for the `play-son` API testing framework, designed as a specialized extension of the Playwright CLI.

---

## CLI Architecture

### 1. Native Playwright Pass-through

The `playson` command acts as a wrapper for `npx playwright`. Even as an API-first framework, it leverages Playwright's powerful debugging and reporting tools.

- **UI Mode (`--ui`)**: Fully supported. Highly recommended for API testing as it provides a visual trace of every request, including headers, payloads, and response bodies.
- **Trace Viewer**: Supported. Allows post-mortem inspection of API failures.
- **Reporting**: Commands like `show-report` are passed through to the underlying Playwright installation.
- **Standard Commands**: `codegen`, `test --debug`, etc., work exactly as they do in native Playwright.
- **Logic**: Custom `play-son` environment/variable injection remains active even in UI mode.

---

## 2. Custom play-son Commands

### `run` (Specialized `playwright test`)

The primary entry point for executing `play-son` JSON-based test suites.

**Usage:**

```bash
playson run [options] [paths...]
```

**Environment Handling:**

- **Mandatory Flag**: The `--env` (or `-e`) flag is **required** by default to prevent accidental runs against the wrong environment.
- **Default Configuration**: A `defaultEnv` can be optionally specified in `project.json`. If present, the `--env` flag becomes optional.

**Key Flags:**

- `--env`, `-e`: Environment selector (Required unless `defaultEnv` is set in `project.json`).
- All native `playwright test` flags (e.g., `--project`, `--list`, `--grep`, `--tags`, `--workers`).

---

### `sync-schemas`

Synchronizes local `schemas/` with the remote OpenAPI/Swagger specification.

**Usage:**

```bash
playson sync-schemas [options]
```

**Workflow:**

1. **Scan**: Compares local files with the remote spec.
2. **Confirm**: Displays a summary: _"Found 12 schemas to update/create. Proceed? [Y/n]"_.
3. **Sync**: Downloads the schemas upon confirmation.
4. **Cleanup**: (Optional) If stale files are found, enters interactive mode.

**Options:**

- `--env`, `-e`: Environment selector.
- **Extraction Modes**:
  - `--all` (Default): Processes all schemas in the spec.
  - `--name <schema-name>`: Only processes specific definitions.
- **Stale Management**:
  - **Interactive (Default)**: Prompts to [d]elete, [s]kip, or [a]bort for each stale file.
  - **`--skip-stale`**: Bypasses the stale check entirely.

---

### `generate` (alias: `g`)

Scaffolds new project resources quickly, inspired by the NestJS CLI.

**Usage:**

```bash
playson g <resource> <name> [options]
```

**Sub-commands:**

- `g var <key> [value]`: Add a new key-value pair to `variables.json`.
- `g env-var <key> <value> --env <name>`:
  - Adds `<key>` to **all** `environments/*.env.json` files.
  - Sets the value to `<value>` in the specified `<name>.env.json`.
  - Sets the value to `null` or `""` in all other environment files.
- `g handler <name>`: Create a new `<name>.handler.ts` file with standard `run` function boilerplate in `handlers/`.
- `g script <name>`: Create a new `<name>.script.json` with a unique `id` and dummy test structure in `scripts/`.
- `g suite <name>`: Create a new `<name>.test.json` boilerplate in `suites/`.

---

### `validate` [path]

Performs static analysis on the project to catch errors before execution.

**Usage:**

```bash
playson validate [path] [options]
```

**Features:**

- **Scoping**: If a `[path]` is provided, it only validates that file and its dependencies.
- **Type Filtering (`--type`, `-t`)**: Target specific categories: `project`, `suite`, `script`, `handler`, `env`, `var`.
- **Interactive Repair (`--repair`)**: Prompts to fix broken `ref` links, duplicate `id`s, or missing environment variables.

---

### `init`

Scaffolds a new `play-son` project directory structure.

**Usage:**

```bash
playson init [project-name]
```

---

## Execution Flow Example

`playson run --env dev --grep "User Auth"`

1. CLI validates `dev.env.json` exists.
2. CLI prepares environment variables and variable store.
3. CLI invokes `playwright test` with internal configuration that points to the `play-son` runner and discovery logic.

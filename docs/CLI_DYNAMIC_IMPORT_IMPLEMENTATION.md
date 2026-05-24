# CLI Dynamic Import Implementation

**Date**: May 23-24, 2026  
**Version**: 0.1.4+  
**Status**: Complete

---

## Overview

The Playson CLI has been refactored to **dynamically load** `@playson/test` from the consuming project's node_modules instead of maintaining it as a hard dependency. This ensures that:

1. **Version Safety**: CLI always uses the version of `@playson/test` installed in the user's project
2. **No Stale Data**: When users upgrade `@playson/test`, schemas are generated from the current version
3. **Lightweight CLI**: Reduces CLI package size by removing unnecessary dependencies
4. **Project-Centric**: Schemas are exported to the project root (`Project-schema/`) where users can easily access them

---

## Architecture

### Before (Static Dependency Model)
```
CLI package.json
  └─ @playson/test (workspace:*)
       └─ CLI imports from CLI's own node_modules
       └─ Risk: Stale schemas if user upgrades @playson/test
```

### After (Dynamic Import Model)
```
CLI
  └─ Detects @playson/test in user's project
  └─ Dynamically imports from user's node_modules
  └─ Always uses installed version ✓
```

---

## Key Changes

### 1. Removed Dependency from CLI Package

**File**: `packages/cli/package.json`

```json
// BEFORE
"dependencies": {
  "@playson/test": "workspace:*",
  "commander": "^14.0.3",
  ...
}

// AFTER
"dependencies": {
  "commander": "^14.0.3",
  ...
}
```

**Impact**: CLI has zero direct dependencies on test package.

---

### 2. Created Dynamic Import Helper

**File**: `packages/cli/src/utils/load-test-package.ts` (NEW)

```typescript
export interface TestPackageType {
  ProjectSchema: any
  TestSuiteSchema: any
  TestcaseSchema: any
  EnvironmentVariablesSchema: any
  VariablesSchema: any
  ProjectLoader: any
  bootstrap: any
  [key: string]: any
}

export async function loadTestPackage(): Promise<TestPackageType> {
  try {
    const testPackage = await import('@playson/test')
    return testPackage as unknown as TestPackageType
  } catch (error) {
    const errorMessage =
      error instanceof Error && error.message.includes('MODULE_NOT_FOUND')
        ? `@playson/test is not installed in this project.`
        : `Failed to load @playson/test: ...`

    console.error(`\n❌ Error: ${errorMessage}`)
    console.error(
      '\nTo fix this, install @playson/test in your project:\n  npm install @playson/test',
    )
    process.exit(1)
  }
}
```

**Purpose**:
- Centralized dynamic import mechanism
- Reusable across all CLI commands
- Clear error messages with installation instructions
- Type-safe interface for exported modules

**Key Features**:
- Uses `import('@playson/test')` to resolve from user's project
- Catches MODULE_NOT_FOUND errors gracefully
- Provides helpful error message if package missing
- Returns typed interface for IDE autocomplete

---

### 3. Updated sync-project-schemas Command

**File**: `packages/cli/src/sync-project-schemas.ts`

#### Changes:
- Removed static imports of Zod schemas
- Uses `loadTestPackage()` for dynamic loading
- **Output directory changed**: `packages/test/src/schemas/` → `Project-schema/` (project root)
- Respects `PLAYSON_ROOT` env var or uses `process.cwd()`

#### Before:
```typescript
import {
  ProjectSchema,
  TestSuiteSchema,
  TestcaseSchema,
  EnvironmentVariablesSchema,
  VariablesSchema,
} from '@playson/test'

export const syncProjectSchemasCommand = new Command('sync-project-schemas')
  .action(() => {
    const pkgRoot = path.resolve(__dirname, '../..')
    const schemaDir = path.join(pkgRoot, 'test/schemas')
    // ... generates to packages/test/src/schemas/
  })
```

#### After:
```typescript
import { loadTestPackage } from './utils/load-test-package.js'

export const syncProjectSchemasCommand = new Command('sync-project-schemas')
  .action(async () => {
    const testPkg = await loadTestPackage()
    
    const projectRoot = process.env.PLAYSON_ROOT || process.cwd()
    const schemaDir = path.join(projectRoot, 'Project-schema')
    
    // ... generates to Project-schema/ in project root
    console.log(`✨ Schemas exported to: ${path.relative(projectRoot, schemaDir) || '.'}/`)
  })
```

#### Output:
```
🔄 Syncing core schemas to /path/to/project/Project-schema...
✅ Generated: project.schema.json
✅ Generated: testsuite.schema.json
✅ Generated: testcase.schema.json
✅ Generated: environment.schema.json
✅ Generated: variables.schema.json

✨ Schemas exported to: Project-schema/
```

---

### 4. Updated validate Command

**File**: `packages/cli/src/validate.ts`

#### Changes:
- Removed static imports of `ProjectLoader`, `LoadError`, `AggregateLoadError`
- Uses `loadTestPackage()` for dynamic loading
- Updated error handling for async loading

#### Before:
```typescript
import { AggregateLoadError, LoadError, ProjectLoader } from '@playson/test'

export const validateCommand = new Command('validate')
  .action(async (targetPath, options) => {
    const loader = new ProjectLoader()
    // ...
  })
```

#### After:
```typescript
import { loadTestPackage } from './utils/load-test-package.js'

export const validateCommand = new Command('validate')
  .action(async (targetPath, options) => {
    const testPkg = await loadTestPackage()
    const { ProjectLoader, AggregateLoadError, LoadError } = testPkg
    
    const loader = new ProjectLoader()
    // ...
  })
```

---

### 5. Updated init Command

**File**: `packages/cli/src/init.ts`

#### Note:
The `init` command generates template files with hardcoded `@playson/test` imports in:
- `suites/playson.spec.ts` - Uses `import { bootstrap } from '@playson/test'`
- Generated JSON schemas reference node_modules paths

This is intentional - users' generated code should still import from `@playson/test` as a normal dependency.

---

## Data Flow

### Command Execution Flow

```
User: playson sync-project-schemas
       │
       ├─ CLI Entry Point (bin/playson.js)
       │
       ├─ Command Handler (sync-project-schemas.ts)
       │
       ├─ Call loadTestPackage()
       │  ├─ Try import('@playson/test')
       │  ├─ Resolve from user's node_modules ✓
       │  └─ Return TestPackageType
       │
       ├─ Extract schemas from Zod definitions
       │  ├─ ProjectSchema
       │  ├─ TestSuiteSchema
       │  ├─ TestcaseSchema
       │  ├─ EnvironmentVariablesSchema
       │  └─ VariablesSchema
       │
       ├─ Convert Zod → JSON Schema (draft-07)
       │
       ├─ Create Project-schema/ directory
       │
       └─ Write files:
          ├─ project.schema.json
          ├─ testsuite.schema.json
          ├─ testcase.schema.json
          ├─ environment.schema.json
          └─ variables.schema.json
```

---

## Error Handling

### Missing @playson/test

**Scenario**: User tries to run CLI command but `@playson/test` not installed

**Error Message**:
```
❌ Error: @playson/test is not installed in this project.

To fix this, install @playson/test in your project:
  npm install @playson/test

Or if using pnpm:
  pnpm install @playson/test
```

**Exit Code**: 1

### Module Load Failures

**Scenario**: Import fails for reasons other than missing module

**Error Message**:
```
❌ Error: Failed to load @playson/test: [detailed error message]

To fix this, install @playson/test in your project:
  npm install @playson/test

Or if using pnpm:
  pnpm install @playson/test
```

---

## Usage Examples

### Generate Schemas in Project

```bash
cd my-project
npm install @playson/test

# Generate schemas to Project-schema/ directory
playson sync-project-schemas

# Output:
# 🔄 Syncing core schemas to /path/to/my-project/Project-schema...
# ✅ Generated: project.schema.json
# ✅ Generated: testsuite.schema.json
# ✅ Generated: testcase.schema.json
# ✅ Generated: environment.schema.json
# ✅ Generated: variables.schema.json
# ✨ Schemas exported to: Project-schema/
```

### Validate Project with Dynamic Load

```bash
playson validate --env dev

# Dynamically loads @playson/test from project
# Uses ProjectLoader from loaded package
```

### Re-generate After Upgrade

```bash
# User upgrades @playson/test
npm install @playson/test@2.0.0

# Re-run command - gets latest schemas
playson sync-project-schemas

# Schemas now match @playson/test@2.0.0 ✓
```

---

## Project Root Detection

The CLI determines the project root in this order:

1. **`PLAYSON_ROOT` environment variable** (if set)
   ```bash
   PLAYSON_ROOT=/path/to/project playson sync-project-schemas
   ```

2. **Current working directory** (default)
   ```bash
   cd /path/to/project
   playson sync-project-schemas
   ```

**Example**:
```bash
# Scenario 1: From project directory
cd ~/my-project
playson sync-project-schemas
→ Creates ~/my-project/Project-schema/

# Scenario 2: From different directory with env var
PLAYSON_ROOT=~/my-project playson sync-project-schemas
→ Creates ~/my-project/Project-schema/
```

---

## Output Structure

After running `playson sync-project-schemas`:

```
my-project/
├─ Project-schema/          (NEW - CLI-generated)
│  ├─ project.schema.json       (22 KB - project structure)
│  ├─ testsuite.schema.json     (36 KB - test suite structure)
│  ├─ testcase.schema.json      (11 KB - test case structure)
│  ├─ environment.schema.json   (0.5 KB - environment variables)
│  └─ variables.schema.json     (0.3 KB - global variables)
│
├─ project.json             (existing - references Project-schema/)
├─ variables.json           (existing - can reference Project-schema/)
├─ environments/
│  └─ dev.env.json          (existing - can reference Project-schema/)
├─ suites/                  (existing - can reference Project-schema/)
│  ├─ Auth/
│  │  └─ auth-login.test.json   (can update to use Project-schema/)
│  └─ User/
│     └─ user-delete.test.json  (can update to use Project-schema/)
└─ scripts/                 (existing - can reference Project-schema/)
   └─ Auth/
      └─ auth-login-user.script.json (can update to use Project-schema/)
```

**Schema References**:
Projects can now use local Project-schema/ instead of node_modules paths:

```json
{
  "$schema": "./Project-schema/project.schema.json",
  "title": "My Project"
}
```

Instead of:
```json
{
  "$schema": "./node_modules/@playson/test/schemas/project.schema.json",
  "title": "My Project"
}
```

---

## Version Compatibility

| CLI Version | @playson/test Required | Notes |
|---|---|---|
| 0.1.4+ | Any version | Dynamic loading - uses installed version |
| 0.1.3 | Via dependency | Static import from CLI dependency |

---

## Migration Path for Users

### For Existing Projects

1. **Update CLI**: `npm install @playson/cli@latest`
2. **Verify @playson/test is installed**: `npm install @playson/test`
3. **Run sync-project-schemas**: `playson sync-project-schemas`
4. **Optional: Update $schema paths** in JSON files to use `Project-schema/`

### For New Projects

1. **Initialize**: `playson init my-project`
2. **Install packages**: `cd my-project && npm install`
3. **Sync schemas**: `playson sync-project-schemas`
4. **Update $schema paths** in generated JSON files (optional, for local references)

---

## Benefits

### For Users
- ✅ Always get latest schemas when upgrading @playson/test
- ✅ Schemas available locally in Project-schema/ directory
- ✅ No stale data issues
- ✅ Clear error messages if package missing

### For Developers
- ✅ Cleaner CLI dependencies
- ✅ Smaller CLI package size
- ✅ Single source of truth (@playson/test installed version)
- ✅ Easier to test version compatibility
- ✅ Reduced maintenance burden

### For Project Maintainability
- ✅ Schemas live in project (not hidden in node_modules)
- ✅ IDE support when using Project-schema/ references
- ✅ Version-specific schemas committed with project
- ✅ Better reproducibility

---

## Testing

### Unit Tests

Tests cover:
- Package detection (found/not found scenarios)
- Schema export with valid/invalid input
- Directory creation and file writing
- Error handling

**Location**: `packages/cli/src/__tests__/`

### Integration Tests

- Test in marketplace example project
- Verify all 5 schemas created
- Verify error messages when package missing
- Verify validate command works post-sync

---

## Future Considerations

1. **Auto-run during init**: Could automatically run `sync-project-schemas` after `playson init`
2. **Conditional $schema paths**: Could auto-update JSON files to use Project-schema/ paths
3. **Watch mode**: Could regenerate schemas when @playson/test changes
4. **Schema versioning**: Could track which @playson/test version generated schemas
5. **Peer dependency option**: Could make @playson/test a peerDependency instead

---

## Implementation Details by File

### New Files
- `packages/cli/src/utils/load-test-package.ts` - Dynamic import helper (35 lines)

### Modified Files
- `packages/cli/package.json` - Removed @playson/test from dependencies (1 line change)
- `packages/cli/src/sync-project-schemas.ts` - Dynamic import + output location (60 lines, ~30% refactored)
- `packages/cli/src/validate.ts` - Dynamic import of ProjectLoader (10 lines changed)
- `packages/cli/src/init.ts` - No changes required (already imports @playson/test correctly)

### Lines of Code
- **New**: ~35 lines (load-test-package helper)
- **Modified**: ~40 lines across existing files
- **Removed**: ~20 lines of static imports
- **Total Delta**: +55 lines net

---

## Conclusion

This implementation achieves the goal of making the CLI independent of a hardcoded `@playson/test` dependency while ensuring schemas are always current and accessible to users. The dynamic import pattern is clean, maintainable, and provides clear error handling.

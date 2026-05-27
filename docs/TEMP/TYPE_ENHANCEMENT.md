# Type System Enhancements (Backlog)

This document tracks planned improvements to the TypeScript configuration and type system to align with modern (2026) standards and improve codebase safety.

## 1. Modernize Root `tsconfig.json`

Upgrade the root configuration to use modern ESM-first flags and stricter checks.

### Proposed Changes
Update `plyson/tsconfig.json` with the following flags:

| Flag | Purpose | Benefit |
| :--- | :--- | :--- |
| `verbatimModuleSyntax` | Replacement for `importsNotUsedAsValues` | Ensures clean ESM output by enforcing `import type`. |
| `noUncheckedIndexedAccess` | Strict index signature checking | Prevents runtime errors when accessing arrays or objects via keys. |
| `isolatedModules` | Single-file transpilation safety | Ensures compatibility with fast build tools like `esbuild` (used by Vitest). |
| `moduleDetection: "force"` | Force module evaluation | Ensures all files are treated as ESM modules. |
| `noImplicitOverride` | Explicit class member overrides | Prevents accidental method shadowing in class inheritance. |
| `lib: ["ESNext"]` | Remove `DOM` library | Prevents accidental usage of browser globals in a Node.js project. |

### Implementation Snippet
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

## 2. Validation Steps
- [ ] Run `pnpm build` (turbo) to ensure no regressions in `@plyson/cli` or `@plyson/test`.
- [ ] Verify `import type` usage in all packages (required by `verbatimModuleSyntax`).
- [ ] Fix potential "possibly undefined" errors triggered by `noUncheckedIndexedAccess`.

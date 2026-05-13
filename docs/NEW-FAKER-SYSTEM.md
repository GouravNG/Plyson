# Faker JSON Schema System

A lightweight schema-driven fake data generation system built on top of `@faker-js/faker`. Define what data you want in JSON — the system finds and delegates to the right faker method automatically.

---

## Overview

Instead of manually writing type checks, format validators, and range handlers, this system lets you describe your data shape in JSON and delegates all generation logic to faker. The result is a minimal, expressive, and highly maintainable data generation pipeline.

---

## Core Design

### The `$gen` Directive

Every generatable field uses a `$gen` key as the directive signal. The value is the **faker method name** (without the module prefix). All remaining keys are passed directly as params to the faker method.

```json
{ "$gen": "<methodName>", "<param>": "<value>", "<param>": "<value>" }
```

### Examples

```json
{ "$gen": "fullName" }
{ "$gen": "email" }
{ "$gen": "int", "min": 18, "max": 65 }
{ "$gen": "alpha", "length": 8 }
{ "$gen": "amount", "min": 100, "max": 5000, "dec": 2 }
{ "$gen": "past" }
{ "$gen": "uuid" }
```

---

## Schema Anatomy

### Simple flat schema

```json
{
  "name":  { "$gen": "fullName" },
  "email": { "$gen": "email" },
  "age":   { "$gen": "int", "min": 18, "max": 65 },
  "id":    { "$gen": "uuid" }
}
```

**Output:**
```json
{
  "name":  "Dr. Alice Monroe",
  "email": "alice.monroe@example.com",
  "age":   34,
  "id":    "b3d2f1a0-..."
}
```

---

### Mixed static + generated

Plain values (no `$gen`) are passed through as-is:

```json
{
  "role":      "admin",
  "active":    true,
  "name":      { "$gen": "fullName" },
  "createdAt": { "$gen": "past" }
}
```

---

### Nested objects

The resolver walks the schema recursively:

```json
{
  "user": {
    "name": { "$gen": "fullName" },
    "contact": {
      "email": { "$gen": "email" },
      "phone": { "$gen": "number" }
    }
  },
  "company": {
    "name":    { "$gen": "name" },
    "address": { "$gen": "streetAddress" }
  }
}
```

---

### Array generation with `$count`

Adding `$count` at the root or field level generates an array of values:

```json
{
  "$gen":   "fullName",
  "$count": 5
}
```

**Output:** `["Alice Monroe", "Bob Smith", "Carol Zhang", ...]`

Or generating an array of full objects:

```json
{
  "$count": 10,
  "name":   { "$gen": "fullName" },
  "email":  { "$gen": "email" },
  "age":    { "$gen": "int", "min": 18, "max": 65 }
}
```

---

### Ambiguous method names with `$module`

Some method names exist across multiple faker modules (e.g. `type()` in `vehicle`, `animal`, `database`). Use `$module` to disambiguate:

```json
{ "$gen": "type", "$module": "vehicle" }
{ "$gen": "type", "$module": "animal" }
```

For unambiguous methods, `$module` is optional — the resolver picks the first match.

As a fallback, fully qualified names always work:

```json
{ "$gen": "vehicle.type" }
```

---

## Technical Implementation

### Method Resolution

The resolver iterates over all faker modules to find the matching method by name:

```js
import { faker } from '@faker-js/faker'

function findFakerMethod(methodName, moduleHint = null) {
  // If fully qualified (e.g. "vehicle.type"), split and resolve directly
  if (methodName.includes('.')) {
    const [mod, fn] = methodName.split('.')
    if (faker[mod] && typeof faker[mod][fn] === 'function') {
      return faker[mod][fn].bind(faker[mod])
    }
    throw new Error(`Faker method not found: ${methodName}`)
  }

  // If $module hint provided, resolve directly
  if (moduleHint) {
    if (faker[moduleHint] && typeof faker[moduleHint][methodName] === 'function') {
      return faker[moduleHint][methodName].bind(faker[moduleHint])
    }
    throw new Error(`Method "${methodName}" not found in module "${moduleHint}"`)
  }

  // Auto-discover: search all modules for the method
  for (const [modName, mod] of Object.entries(faker)) {
    if (typeof mod === 'object' && typeof mod[methodName] === 'function') {
      return mod[methodName].bind(mod)
    }
  }

  throw new Error(`No faker method found for: "${methodName}"`)
}
```

---

### Schema Resolver

The core recursive resolver that walks a schema and generates values:

```js
function resolve(schema) {
  // Primitive or null — return as-is
  if (schema === null || typeof schema !== 'object') return schema

  // Array — resolve each element
  if (Array.isArray(schema)) return schema.map(resolve)

  const { $gen, $count, $module, ...params } = schema

  // No $gen directive — recurse into object fields
  if (!$gen) {
    if ($count) {
      // $count on plain object → generate array of objects
      return Array.from({ length: $count }, () =>
        resolve({ ...params })
      )
    }
    return Object.fromEntries(
      Object.entries(schema).map(([key, val]) => [key, resolve(val)])
    )
  }

  // Has $gen — find and call the faker method
  const method = findFakerMethod($gen, $module)

  const generate = () =>
    Object.keys(params).length > 0
      ? method(params)   // pass params object if any
      : method()         // call with no args

  // $count on a $gen field → return array
  if ($count) {
    return Array.from({ length: $count }, generate)
  }

  return generate()
}
```

---

### Usage

```js
const schema = {
  "$count": 3,
  "name":   { "$gen": "fullName" },
  "email":  { "$gen": "email" },
  "age":    { "$gen": "int", "min": 18, "max": 65 },
  "id":     { "$gen": "uuid" },
  "address": {
    "street":  { "$gen": "streetAddress" },
    "city":    { "$gen": "city" },
    "country": { "$gen": "country" }
  }
}

console.log(resolve(schema))
```

**Output:**
```json
[
  {
    "name": "Dr. Alice Monroe",
    "email": "alice@example.com",
    "age": 34,
    "id": "b3d2f1a0-...",
    "address": {
      "street": "123 Maple Ave",
      "city": "Springfield",
      "country": "United States"
    }
  },
  ...
]
```

---

## Why This Works

| Concern | Who Handles It |
|---|---|
| Type correctness | Faker |
| Value format (email, uuid, iban...) | Faker |
| Range validation (min/max) | Faker |
| Locale-aware data | Faker |
| Realistic data quality | Faker |
| Schema parsing & routing | Your resolver (3 functions) |

Your backend code has exactly **one job**: find the method and call it. Faker does the rest.

---

## Reserved Keys

| Key | Purpose |
|---|---|
| `$gen` | Faker method name (required for generation) |
| `$count` | Number of items to generate (array output) |
| `$module` | Module hint for ambiguous method names |

All other keys in a `$gen` node are forwarded as params to the faker method.

---

## Error Handling

```js
function resolve(schema) {
  try {
    // ... resolution logic
  } catch (err) {
    if (err.message.includes('No faker method found')) {
      throw new Error(`Unknown $gen method: "${schema.$gen}". Check fakerjs.dev/api for valid methods.`)
    }
    throw err
  }
}
```

Errors surface clearly with the offending method name, making debugging straightforward.

---

## Locale Support

Pass a locale-aware faker instance to the resolver for region-specific data:

```js
import { fakerDE as faker } from '@faker-js/faker'

// All generated data will use German locale
resolve(schema, faker)
```

---

## Potential Extensions

- **`$oneOf`** — randomly pick from a list of static values

---

## Dependencies

```bash
npm install @faker-js/faker
```

No other dependencies required. The entire resolver is ~40 lines of plain JavaScript.

---

## Summary

This system turns faker's entire API surface into a declarative JSON interface. You get:

- **Zero type-switch logic** in your backend
- **Full faker capability** through a simple `$gen` key
- **Nested, mixed, and array schemas** out of the box
- **Ambiguity resolution** via `$module` or fully qualified names
- **Extensible** with reserved `$` keys for future features
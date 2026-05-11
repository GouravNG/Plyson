# Assertions

Assertions validate the response body or headers after each test step. Each assertion extracts a value at a given `path` and applies an `operator` to it.

```typescript
type Assertions = {
  title: string
  from: "body" | "header"
  path: string
  operator: AssertionOperators
  value?: any
  validation?: "warn" | "error" // defaults to "error"
}
```

---

## Fields

**`title`** — label shown in the test report to identify the assertion.

**`from`** — where to extract the value from.

- `"body"` — path is a JSONPath (`$.field`) or JMESPath (`field`) expression against the response body.
- `"header"` — path is the header key name (e.g. `"content-type"`).

**`path`** — points to the value being asserted.

- JSONPath: starts with `$`, uses dot notation. e.g. `$.data.user.status`
- JMESPath: no prefix, uses dot notation. e.g. `data.user.status`
- Header key: plain string. e.g. `"x-request-id"`

**`operator`** — the assertion to perform. See groups below.

**`value`** — the expected value. Required for most operators; omitted for existence, type, and array emptiness checks.

**`validation`** — controls how a failure is reported. `"error"` (default) fails the test. `"warn"` marks it as a warning and lets the test continue.

---

## Filtering arrays with path expressions

When asserting against items inside an array, use filter expressions directly in the `path` rather than adding a new operator. The filtered result is an array, which you then assert on using the array operators.

**JSONPath filter syntax:**

```
$.items[?(@.status=='disabled')]
```

`@` refers to the current item being evaluated.

**JMESPath filter syntax:**

```
items[?status=='disabled']
```

Both return an array of matched items — use `isEmpty` or `isNotEmpty` to assert on the result.

---

## Operators

### Equality

Deep equality — works correctly for primitives, objects, and arrays.

| Operator    | Description                        | `value` required |
| ----------- | ---------------------------------- | ---------------- |
| `equals`    | Value deep-equals expected         | yes              |
| `notEquals` | Value does not deep-equal expected | yes              |

```json
{
  "title": "user status is active",
  "from": "body",
  "path": "$.data.status",
  "operator": "equals",
  "value": "active"
}
```

---

### Existence

Checks whether a path is present or absent. No `value` needed.

| Operator    | Description                         |
| ----------- | ----------------------------------- |
| `exists`    | Path is present and not `undefined` |
| `notExists` | Path is absent or `undefined`       |
| `isNull`    | Value is explicitly `null`          |
| `isNotNull` | Value is not `null`                 |

```json
{
  "title": "refresh token is not returned in response",
  "from": "body",
  "path": "$.data.refreshToken",
  "operator": "notExists"
}
```

---

### Numeric comparison

For counts, amounts, pagination totals, and any numeric field. `value` must be a `number`.

| Operator                | Description       |
| ----------------------- | ----------------- |
| `isGreaterThan`         | value > expected  |
| `isLessThan`            | value < expected  |
| `isGreaterThanOrEquals` | value >= expected |
| `isLessThanOrEquals`    | value <= expected |

```json
{
  "title": "response time is under threshold",
  "from": "body",
  "path": "$.meta.total",
  "operator": "isGreaterThan",
  "value": 0
}
```

---

### String

For message text, error codes, field formats, and identifiers. `value` must be a `string`.

| Operator      | Description                           |
| ------------- | ------------------------------------- |
| `contains`    | String includes a substring           |
| `notContains` | String does not include substring     |
| `matches`     | String matches a regex pattern        |
| `notMatches`  | String does not match a regex pattern |

```json
{
  "title": "error message mentions the invalid field",
  "from": "body",
  "path": "$.error.message",
  "operator": "contains",
  "value": "email"
}
```

```json
{
  "title": "id follows uuid format",
  "from": "body",
  "path": "$.data.id",
  "operator": "matches",
  "value": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
}
```

---

### Array

For list results, paginated responses, and multi-value fields.

| Operator       | Description                         | `value` type |
| -------------- | ----------------------------------- | ------------ |
| `hasLength`    | Array has exact length              | `number`     |
| `hasMinLength` | Array has at least N items          | `number`     |
| `hasMaxLength` | Array has no more than N items      | `number`     |
| `includes`     | Array contains this element (deep)  | `any`        |
| `notIncludes`  | Array does not contain this element | `any`        |
| `isEmpty`      | Array has zero items                | —            |
| `isNotEmpty`   | Array has at least one item         | —            |

```json
{
  "title": "response returns exactly one page of results",
  "from": "body",
  "path": "$.data.items",
  "operator": "hasMaxLength",
  "value": 20
}
```

**Asserting array items by field value** — use a filter expression in `path` and an emptiness operator:

```json
{
  "title": "no item in the list has status disabled",
  "from": "body",
  "path": "$.data.items[?(@.status=='disabled')]",
  "operator": "isEmpty"
}
```

```json
{
  "title": "at least one item is flagged as featured",
  "from": "body",
  "path": "$.data.items[?(@.featured==true)]",
  "operator": "isNotEmpty"
}
```

---

### Object / partial match

Asserts a response body contains at least the specified key/value pairs, without requiring every field to be specified. `value` must be a plain object.

| Operator            | Description                                  |
| ------------------- | -------------------------------------------- |
| `containsSubset`    | Body contains at least these key/value pairs |
| `notContainsSubset` | Body does not match this partial shape       |

```json
{
  "title": "created user has expected role and plan",
  "from": "body",
  "path": "$.data",
  "operator": "containsSubset",
  "value": { "role": "admin", "plan": "pro", "active": true }
}
```

---

### Type

For catching schema drift — asserting a field's type hasn't changed. No `value` needed.

| Operator    | Description                                   |
| ----------- | --------------------------------------------- |
| `isString`  | Value is a string                             |
| `isNumber`  | Value is a number                             |
| `isBoolean` | Value is a boolean                            |
| `isArray`   | Value is an array                             |
| `isObject`  | Value is a plain object (not array, not null) |

```json
{
  "title": "price field is always returned as a number",
  "from": "body",
  "path": "$.data.price",
  "operator": "isNumber",
  "validation": "warn"
}
```

---

## TypeScript type

```typescript
type AssertionOperators =
  | "equals"
  | "notEquals"
  | "exists"
  | "notExists"
  | "isNull"
  | "isNotNull"
  | "isGreaterThan"
  | "isLessThan"
  | "isGreaterThanOrEquals"
  | "isLessThanOrEquals"
  | "contains"
  | "notContains"
  | "matches"
  | "notMatches"
  | "hasLength"
  | "hasMinLength"
  | "hasMaxLength"
  | "includes"
  | "notIncludes"
  | "isEmpty"
  | "isNotEmpty"
  | "containsSubset"
  | "notContainsSubset"
  | "isString"
  | "isNumber"
  | "isBoolean"
  | "isArray"
  | "isObject"

type Assertions = {
  title: string
  from: "body" | "header"
  path: string
  operator: AssertionOperators
  value?: any
  validation?: "warn" | "error"
}
```

---

## Full step example

```json
{
  "title": "fetch paginated users",
  "request": {
    "method": "GET",
    "endpoint": "/api/v1/users",
    "queryParams": { "page": 1, "limit": 10 }
  },
  "response": {
    "validations": {
      "statusCode": 200,
      "assertions": [
        {
          "title": "data array is present",
          "from": "body",
          "path": "$.data",
          "operator": "exists"
        },
        {
          "title": "returns at most 10 users",
          "from": "body",
          "path": "$.data",
          "operator": "hasMaxLength",
          "value": 10
        },
        {
          "title": "no user in the list is disabled",
          "from": "body",
          "path": "$.data[?(@.status=='disabled')]",
          "operator": "isEmpty"
        },
        {
          "title": "each user has expected shape",
          "from": "body",
          "path": "$.data[0]",
          "operator": "containsSubset",
          "value": { "id": "", "email": "", "role": "" },
          "validation": "warn"
        },
        {
          "title": "content-type is json",
          "from": "header",
          "path": "content-type",
          "operator": "contains",
          "value": "application/json"
        }
      ]
    }
  }
}
```

# Assertion Operator Reference

This guide maps common markdown assertion patterns to their JSON equivalents in the testsuite schema.

---

## Operator Categories

Operators are grouped by type and use case:

| Category       | Operators                                                                    | Use Case                |
| -------------- | ---------------------------------------------------------------------------- | ----------------------- |
| **Equality**   | `equals`, `equalsIgnoreCase`, `notEquals`                                    | Exact value matching    |
| **Existence**  | `exists`, `notExists`, `isNull`, `isNotNull`                                 | Presence/absence checks |
| **Comparison** | `isGreaterThan`, `isLessThan`, `isGreaterThanOrEquals`, `isLessThanOrEquals` | Numeric comparisons     |
| **String**     | `contains`, `notContains`, `matches`, `notMatches`, `isEmpty`, `isNotEmpty`  | String patterns         |
| **Length**     | `hasLength`, `hasMinLength`, `hasMaxLength`                                  | Field length validation |
| **Arrays**     | `includes`, `notIncludes`, `containsSubset`, `notContainsSubset`             | Array membership        |
| **Type**       | `isString`, `isNumber`, `isBoolean`, `isArray`, `isObject`                   | Type validation         |

---

## Common Markdown Patterns → JSON Conversion

### Equality Checks

#### Pattern: Exact value match

**Markdown:**

```
Assertion: response.status == 200
Assertion: response.body.role == "USER"
Assertion: response.body.active == true
```

**JSON:**

```json
{
  "assertions": [
    {
      "title": "Response status is 200",
      "from": "body",
      "path": "$.status",
      "operator": "equals",
      "value": 200
    },
    {
      "title": "User role is USER",
      "from": "body",
      "path": "$.role",
      "operator": "equals",
      "value": "USER"
    },
    {
      "title": "Account is active",
      "from": "body",
      "path": "$.active",
      "operator": "equals",
      "value": true
    }
  ]
}
```

#### Pattern: Case-insensitive match

**Markdown:**

```
Assertion: response.status.toLowerCase() == "success"
Assertion: response.body.email (case-insensitive) matches user@example.com
```

**JSON:**

```json
{
  "operator": "equalsIgnoreCase",
  "value": "success"
}
```

#### Pattern: Not equal

**Markdown:**

```
Assertion: response.statusCode != 500
Assertion: response.body.userId != null
```

**JSON:**

```json
{
  "operator": "notEquals",
  "value": 500
}
```

---

### Existence Checks

#### Pattern: Field exists

**Markdown:**

```
Assertion: response.body.contains userId field
Assertion: response.headers["X-Request-ID"] exists
```

**JSON:**

```json
{
  "title": "Response contains userId",
  "from": "body",
  "path": "$.userId",
  "operator": "exists"
}
```

#### Pattern: Field does not exist

**Markdown:**

```
Assertion: response.body does NOT contain password field
```

**JSON:**

```json
{
  "operator": "notExists",
  "path": "$.password"
}
```

#### Pattern: Is null / is not null

**Markdown:**

```
Assertion: response.body.deletedAt is null (not deleted)
Assertion: response.body.updatedAt is not null
```

**JSON:**

```json
{
  "operator": "isNull",
  "path": "$.deletedAt"
},
{
  "operator": "isNotNull",
  "path": "$.updatedAt"
}
```

---

### Numeric Comparisons

#### Pattern: Greater than / Less than

**Markdown:**

```
Assertion: response.body.itemCount > 0
Assertion: response.body.price < 1000
Assertion: response.body.discount >= 10
Assertion: response.body.stockLevel <= 100
```

**JSON:**

```json
{
  "operator": "isGreaterThan",
  "value": 0
},
{
  "operator": "isLessThan",
  "value": 1000
},
{
  "operator": "isGreaterThanOrEquals",
  "value": 10
},
{
  "operator": "isLessThanOrEquals",
  "value": 100
}
```

---

### String Patterns

#### Pattern: Contains substring

**Markdown:**

```
Assertion: error message contains "validation"
Assertion: response.body.message includes "Invalid email"
```

**JSON:**

```json
{
  "title": "Error message contains validation error",
  "from": "body",
  "path": "$.message",
  "operator": "contains",
  "value": "validation"
}
```

#### Pattern: Does not contain

**Markdown:**

```
Assertion: response does NOT contain sensitive data (password, token)
Assertion: error message does not include "password"
```

**JSON:**

```json
{
  "operator": "notContains",
  "value": "password"
}
```

#### Pattern: Regex match

**Markdown:**

```
Assertion: email matches pattern /^[a-z]+@[a-z]+\.[a-z]+$/
Assertion: ISO date matches /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
```

**JSON:**

```json
{
  "title": "Email format is valid",
  "from": "body",
  "path": "$.email",
  "operator": "matches",
  "value": "^[a-z]+@[a-z]+\\.[a-z]+$"
}
```

#### Pattern: Empty / Not empty

**Markdown:**

```
Assertion: response.body.errors is empty
Assertion: response.body.message is not empty
```

**JSON:**

```json
{
  "operator": "isEmpty"
},
{
  "operator": "isNotEmpty"
}
```

---

### String Length

#### Pattern: Exact length

**Markdown:**

```
Assertion: password has length 12
Assertion: zip code has exactly 5 characters
```

**JSON:**

```json
{
  "operator": "hasLength",
  "value": 12
}
```

#### Pattern: Min/Max length

**Markdown:**

```
Assertion: password has minimum length 8
Assertion: name has maximum length 100
```

**JSON:**

```json
{
  "operator": "hasMinLength",
  "value": 8
},
{
  "operator": "hasMaxLength",
  "value": 100
}
```

---

### Array Operations

#### Pattern: Array includes value

**Markdown:**

```
Assertion: roles array includes "ADMIN"
Assertion: response.body.tags contains "premium"
```

**JSON:**

```json
{
  "title": "User has ADMIN role",
  "from": "body",
  "path": "$.roles[*]",
  "operator": "includes",
  "value": "ADMIN"
}
```

#### Pattern: Array does not include value

**Markdown:**

```
Assertion: permissions array does NOT include "delete_users"
```

**JSON:**

```json
{
  "operator": "notIncludes",
  "value": "delete_users"
}
```

#### Pattern: Array contains subset

**Markdown:**

```
Assertion: response.body.roles contains all of ["ADMIN", "USER"]
Assertion: cart items include products with IDs [101, 102, 103]
```

**JSON:**

```json
{
  "title": "User has all required roles",
  "from": "body",
  "path": "$.roles",
  "operator": "containsSubset",
  "value": ["ADMIN", "USER"]
}
```

#### Pattern: Array does not contain subset

**Markdown:**

```
Assertion: banned roles do NOT include "SUPERADMIN"
```

**JSON:**

```json
{
  "operator": "notContainsSubset",
  "value": ["SUPERADMIN"]
}
```

---

### Type Validation

#### Pattern: Type checking

**Markdown:**

```
Assertion: response.body.email is string
Assertion: response.body.price is number
Assertion: response.body.active is boolean
Assertion: response.body.items is array
Assertion: response.body.metadata is object
```

**JSON:**

```json
{
  "operator": "isString"
},
{
  "operator": "isNumber"
},
{
  "operator": "isBoolean"
},
{
  "operator": "isArray"
},
{
  "operator": "isObject"
}
```

---

## Response Headers

All operators work on response headers. Use `"from": "header"` and header name as path:

**Markdown:**

```
Assertion: response header "Content-Type" equals "application/json"
Assertion: response header "X-Request-ID" exists
Assertion: response header "Cache-Control" contains "no-cache"
```

**JSON:**

```json
{
  "title": "Content-Type is JSON",
  "from": "header",
  "path": "Content-Type",
  "operator": "equals",
  "value": "application/json"
},
{
  "title": "X-Request-ID header exists",
  "from": "header",
  "path": "X-Request-ID",
  "operator": "exists"
},
{
  "title": "Cache-Control header contains no-cache",
  "from": "header",
  "path": "Cache-Control",
  "operator": "contains",
  "value": "no-cache"
}
```

---

## JSON Path Syntax (JSONPath)

Use JSONPath expressions in the `path` field to target nested properties:

| Path Expression    | Target                   | Example                |
| ------------------ | ------------------------ | ---------------------- |
| `$.field`          | Root level field         | `$.email`              |
| `$.nested.field`   | Nested property          | `$.user.profile.email` |
| `$.array[0]`       | First array element      | `$.errors[0]`          |
| `$.array[*]`       | All array elements       | `$.roles[*]`           |
| `$.array[*].field` | Field in all array items | `$.errors[*].field`    |
| `$.["field-name"]` | Field with special chars | `$.["content-type"]`   |

### Examples

**Markdown:**

```
Assertion: errors array first item has field "email"
Assertion: all cart items have price > 0
Assertion: user profile contains email
```

**JSON:**

```json
{
  "path": "$.errors[0].field",
  "operator": "equals",
  "value": "email"
},
{
  "path": "$.cartItems[*].price",
  "operator": "isGreaterThan",
  "value": 0
},
{
  "path": "$.user.profile.email",
  "operator": "exists"
}
```

---

## Combining Multiple Assertions

When markdown has multiple assertions in one step:

**Markdown:**

```
Assertion: response.status == 200 AND response.body.role == "USER" AND response.body.email == user@example.com
```

**JSON:**

```json
{
  "validations": {
    "statusCode": 200,
    "assertions": [
      {
        "title": "User role is USER",
        "from": "body",
        "path": "$.role",
        "operator": "equals",
        "value": "USER"
      },
      {
        "title": "User email matches request",
        "from": "body",
        "path": "$.email",
        "operator": "equals",
        "value": "user@example.com"
      }
    ]
  }
}
```

---

## Validation Levels

Each assertion can have a `validation` field to control severity:

**Markdown:**

```
Assertion (WARN): response time < 1000ms (performance check)
Assertion (ERROR): status code is 200 (must pass)
```

**JSON:**

```json
{
  "title": "Response time is acceptable",
  "from": "header",
  "path": "response-time",
  "operator": "isLessThan",
  "value": 1000,
  "validation": "warn"
},
{
  "title": "Status code is 200",
  "from": "body",
  "path": "$.statusCode",
  "operator": "equals",
  "value": 200,
  "validation": "error"
}
```

---

## Complete Example: Multi-step Assertions

**Markdown:**

```
### TC_PRODUCT_001: Create product and verify response

**Steps:**
1. POST /products with name="Widget", price=19.99
2. Verify status 201
3. Verify response contains productId, name, price
4. Verify productId is numeric and > 0
5. Verify price matches request value exactly
6. Verify created timestamp exists and is ISO format
7. Verify name is not empty and length <= 255

**Assertions:**
- Status == 201
- Body has productId field (exists)
- Body has name field (exists)
- Body has price field (exists)
- productId is number AND > 0
- price == 19.99 (matches request)
- createdAt matches /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
- name is not empty
- name has max length 255
```

**JSON:**

```json
{
  "validations": {
    "statusCode": 201,
    "assertions": [
      {
        "title": "Response contains productId",
        "from": "body",
        "path": "$.productId",
        "operator": "exists"
      },
      {
        "title": "ProductId is numeric",
        "from": "body",
        "path": "$.productId",
        "operator": "isNumber"
      },
      {
        "title": "ProductId is greater than 0",
        "from": "body",
        "path": "$.productId",
        "operator": "isGreaterThan",
        "value": 0
      },
      {
        "title": "Price matches request value",
        "from": "body",
        "path": "$.price",
        "operator": "equals",
        "value": 19.99
      },
      {
        "title": "Created timestamp is ISO format",
        "from": "body",
        "path": "$.createdAt",
        "operator": "matches",
        "value": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$"
      },
      {
        "title": "Product name is not empty",
        "from": "body",
        "path": "$.name",
        "operator": "isNotEmpty"
      },
      {
        "title": "Product name has max length 255",
        "from": "body",
        "path": "$.name",
        "operator": "hasMaxLength",
        "value": 255
      }
    ]
  }
}
```

---

## Quick Reference Table

| Markdown Pattern     | JSON Operator           | Example Value |
| -------------------- | ----------------------- | ------------- |
| `== value`           | `equals`                | `"USER"`      |
| `!= value`           | `notEquals`             | `500`         |
| `field exists`       | `exists`                | (no value)    |
| `field missing`      | `notExists`             | (no value)    |
| `is null`            | `isNull`                | (no value)    |
| `is not null`        | `isNotNull`             | (no value)    |
| `> N`                | `isGreaterThan`         | `0`           |
| `< N`                | `isLessThan`            | `1000`        |
| `>= N`               | `isGreaterThanOrEquals` | `10`          |
| `<= N`               | `isLessThanOrEquals`    | `100`         |
| `contains "x"`       | `contains`              | `"substring"` |
| `not contains "x"`   | `notContains`           | `"password"`  |
| `matches /regex/`    | `matches`               | `"^[a-z]+$"`  |
| `array includes "x"` | `includes`              | `"ADMIN"`     |
| `is type string`     | `isString`              | (no value)    |
| `is type number`     | `isNumber`              | (no value)    |
| `length == N`        | `hasLength`             | `5`           |
| `min length N`       | `hasMinLength`          | `8`           |
| `max length N`       | `hasMaxLength`          | `100`         |
| `is empty`           | `isEmpty`               | (no value)    |
| `is not empty`       | `isNotEmpty`            | (no value)    |

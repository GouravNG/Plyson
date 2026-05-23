# Data Generation & Variable Interpolation

`playson` provides a powerful dual-system for handling dynamic data: **Variable Interpolation** for reusing values and **Dynamic Generators** (backed by Faker.js) for creating fresh data on the fly.

---

## 1. Variable Interpolation (`{{variable}}`)

Simple placeholders used within strings to inject values from the `VariableStore`.

### Syntax

- **Basic**: `"{{userId}}"`
- **Combined**: `"Bearer {{token}}"`
- **Path/Query**: `"/users/{{userId}}/profile"`

### Reserved Global Variables

These are always available without being defined in `variables.json`:

- `{{$timestamp}}`: Current Unix timestamp in milliseconds.
- `{{$isoDate}}`: Current date in ISO-8601 format.
- `{{$guid}}`: A fresh UUID v4.

---

## 2. Dynamic Generators (`$gen`)

For complex or parameterized data generation, use the Object Pattern. This can be used anywhere a value is expected (Payload, Headers, Variables).

### Syntax

```json
{
  "$gen": "generatorName",
  "option1": "value",
  "option2": 123
}
```

### Common Generators

#### Alphanumeric String (Fixed Length)

Generates a random string containing letters and numbers.

```json
{
  "$gen": "string",
  "length": 4,
  "alphanumeric": true
}
```

#### Numeric String (Fixed Length)

Generates a string of digits (preserves leading zeros). Useful for OTPs or PINs.

```json
{
  "$gen": "string",
  "length": 4,
  "numeric": true
}
```

#### Dynamic Length String

You can nest generators to create highly variable data.

```json
{
  "$gen": "string",
  "length": { "$gen": "number", "min": 0, "max": 99 }
}
```

#### Specialized Generators (Faker-backed)

- `{ "$gen": "email" }`: Random email address.
- `{ "$gen": "fullName" }`: Random person name.
- `{ "$gen": "phoneNumber" }`: Random phone number.

---

## 3. Complex Examples

### Email with Timestamp

To create a unique but traceable email address:

```json
"email": "tester+{{$timestamp}}@example.com"
```

### Variable + Timestamp

Combine a stored variable with a dynamic suffix:

```json
"orderReference": "{{prefix}}_{{$timestamp}}"
```

---

## 4. Resolution Lifecycle

1.  **Variable Phase**: Before a test case starts, all `$gen` objects in the `variables` block are resolved. These values become **static** for the duration of that test case.
2.  **Step Phase**: Immediately before an HTTP request is sent, all `$gen` objects and `{{tokens}}` in the `request` object (payload, endpoint, headers) are resolved. `$gen` objects here generate **new** values for every execution.

---

## 5. Summary Table

| Requirement              | Syntax / Pattern                                        |
| :----------------------- | :------------------------------------------------------ |
| **Simple Variable**      | `"{{myVar}}"`                                           |
| **Current Time (Unix)**  | `"{{$timestamp}}"`                                      |
| **Current Date (ISO)**   | `"{{$isoDate}}"`                                        |
| **Alphanumeric (Len 4)** | `{"$gen": "string", "length": 4, "alphanumeric": true}` |
| **Numeric Only (Len 4)** | `{"$gen": "string", "length": 4, "numeric": true}`      |
| **Random Range (0-99)**  | `{"$gen": "number", "min": 0, "max": 99}`               |
| **Combined String**      | `"prefix_{{var}}_{{$timestamp}}"`                       |

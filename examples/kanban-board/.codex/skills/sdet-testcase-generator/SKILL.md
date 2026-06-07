---
name: sdet-testcase-generator
description: >
  Generates structured, automation-ready QA test cases from raw requirement text or user stories.
  Trigger this skill whenever the user provides a user story, acceptance criteria, functional
  requirement, or any feature description and wants test cases generated from it — even if they
  phrase it casually ("write tests for this", "what should I test here", "generate test scenarios",
  "create QA cases", "break this story into test cases"). Also trigger when the user pastes a
  PRD, BRD, or Jira-style story and asks anything related to quality, testing, validation, or coverage.
  Always use this skill before writing a single test case — it defines the full derivation process
  and output format.
---

# SDET Test Case Generator

Generates a complete, automation-ready test suite from raw requirement text or user stories.
Output is a structured linear narrative grouped by user story, covering positive, negative,
boundary, security, and integration scenarios, with full traceability back to acceptance criteria.

---

## Input

The user will provide one of the following (or a mix):

- A full user story in "As a / I want / So that" format
- Acceptance criteria (numbered or bulleted)
- A functional requirements document or section
- A pasted Jira/Linear story

No structured format is required from the user. Extract everything needed from the raw text.

---

## Step 1 — Parse and Decompose the Requirement

Before writing any test case, extract the following from the input:

| Dimension            | What to identify                                                    |
| -------------------- | ------------------------------------------------------------------- |
| **Story ID**         | Use the ID if present (e.g. AUTH-01). If absent, assign TC_MOD_NNN. |
| **Actors**           | Who initiates the action?                                           |
| **Pre-conditions**   | What must be true before the flow starts?                           |
| **Triggers**         | What event/call starts the action?                                  |
| **Business rules**   | Every `if/else`, `AND/OR`, constraint, or conditional in the AC     |
| **Post-conditions**  | Expected system state after success                                 |
| **Data constraints** | Field formats, lengths, mandatory vs optional, enumerations         |
| **Error states**     | What must happen on invalid input or system failure?                |
| **Integrations**     | What downstream systems, events, or side effects are involved?      |
| **Security rules**   | Sensitive fields, access control, data exposure rules               |

> Do not skip this step. Every business rule identified here must map to at least one test case.

---

## Step 2 — Classify Required Test Types

For each story, determine which test types apply:

| Type            | When to include                                                                 |
| --------------- | ------------------------------------------------------------------------------- |
| **Positive**    | Always — at least one happy-path case per story                                 |
| **Negative**    | For every validation rule, rejected state, and error condition                  |
| **Boundary**    | For every numeric/length/date constraint (test at min, max, min-1, max+1)       |
| **Security**    | When sensitive data, auth, or access control is mentioned                       |
| **Integration** | When the story produces side effects (notifications, DB writes, events, emails) |

---

## Step 3 — Generate Test Cases

Apply these rules when writing each test case:

### Naming convention

```
TC_<STORY_ID>_<NNN>
```

Example: `TC_AUTH01_003`

### Title format

```
[Action] when [Condition] → [Expected Outcome]
```

Example: `Registration rejected when email format is invalid → 400 with validation error`

### Priority assignment

| Priority | Criteria                                                                    |
| -------- | --------------------------------------------------------------------------- |
| **P0**   | Core happy path, auth enforcement, security rules, data-never-exposed rules |
| **P1**   | All negative cases, boundary cases, integration side effects                |
| **P2**   | Edge cases, idempotency, race conditions, rarely-hit states                 |

### Layer assignment

| Layer           | Use when                                               |
| --------------- | ------------------------------------------------------ |
| **API**         | Business logic lives in an endpoint (most cases)       |
| **Unit**        | Pure function / validation logic with no I/O           |
| **Integration** | Cross-service behaviour, async events, DB state checks |
| **UI**          | Only when behaviour is exclusively front-end           |

---

## Step 4 — Output Format

Produce a linear narrative for each user story:

### 4a — Story header

```
## <STORY_ID> — <Story Title>

**Source AC:**
<paste the acceptance criteria verbatim from the input>

**Summary:** P0: N | P1: N | P2: N | Total: N cases

---
```

### 4b — Linear test case blocks

For each test case, create a distinct block following this format:

```
### TC_<STORY_ID>_<NNN>: <Title>

**Type:** positive / negative / boundary / security / integration
**Priority:** P0 / P1 / P2
**Layer:** API / Unit / Integration / UI
**AC Reference:** AC-X

**Pre-condition:**
<State or setup required before test>

**Steps:**
1. <atomic action>
2. <atomic action>
3. <atomic action>

**Expected Result:**
<Verifiable outcome - status code, response message, system state>

**Assertion:**
<Exact assertion logic for automation code>
```

### Example block

```
### TC_AUTH01_003: Registration rejected when email format is invalid → 400 with structured error

**Type:** negative
**Priority:** P0
**Layer:** API
**AC Reference:** AC-2

**Pre-condition:**
No pre-condition needed. Service is available.

**Steps:**
1. POST /auth/register with email=`notanemail`
2. Include all other required fields with valid values (firstname, lastname, password)
3. Send request

**Expected Result:**
400 Bad Request. Response body contains validation error array listing email field with format violation. No account created in database.

**Assertion:**
`response.status == 400` AND `errors` array contains `{field: "email", message: "Invalid email format"}` AND database query returns 0 rows for this email
```

---

## Step 5 — Coverage Checklist (run mentally before finalising)

Before outputting, verify:

- [ ] Every acceptance criterion maps to at least one test case
- [ ] Every field constraint has a boundary test at `min-1`, `min`, `max`, `max+1`
- [ ] Every `if/else` branch in the AC has its own case
- [ ] All sensitive fields (passwords, tokens, PII) have a "never exposed" security test
- [ ] Every error message has a negative test that checks the message is generic where required (no field enumeration)
- [ ] All downstream side effects (notifications, events, DB state) have an integration test
- [ ] No test depends on another test's output (tests are independent)
- [ ] Every step is atomic and parameterisable (no hardcoded values — use `<email>`, `<password>` placeholders)
- [ ] A traceability column links every test back to its AC

---

## Step 6 — Traceability Matrix

After all stories are processed, output a final traceability matrix in linear format:

```
## Traceability Matrix

**AC-1: Valid email required**
- Test cases: TC_AUTH01_003, TC_AUTH01_004
- Coverage: ✅ Covered (negative + boundary)

**AC-2: Default role = USER**
- Test cases: TC_AUTH01_001
- Coverage: ✅ Covered (positive flow)

**AC-5: Password must be 8+ characters**
- Test cases: TC_AUTH01_005, TC_AUTH01_006
- Coverage: ✅ Covered (boundary at min-1, min, max)
```

Every AC must have at least one test ID. Flag any uncovered AC with `⚠️ No test`.

---

## General Rules

- **Never hardcode test data.** Use placeholder notation: `<valid_email>`, `<short_password>`, `<existing_email>`.
- **Write assertions as executable logic**, not prose. Prefer `response.status == 400 AND errors[].field == "email"` over "should show an error".
- **One test, one concern.** Do not combine multiple validations into one test case.
- **Security tests are always P0.** Sensitive data exposure and auth enforcement are never deprioritised.
- **Deleted/soft-deleted entities always get their own test.** They are a common source of bugs.
- **Test idempotency for mutation endpoints** (POST, PUT, DELETE) at P2 — what happens on a duplicate call?
- **Generic error messages need two tests**: one for wrong field A, one for wrong field B — both must return identical error text (prevents field enumeration attacks).

---

## Output Rules

- Output all stories in the order they appear in the input.
- Use linear narrative blocks — each test case as its own clearly labeled section.
- Use `---` separator lines between test case blocks for readability.
- Use bold markdown (`**text**`) for field labels (Type, Priority, Layer, etc.).
- Do not truncate Steps or Assertion sections. Be explicit and complete.
- Use numbered lists for Steps, bullet points for Expected Result items when appropriate.
- After the full test suite, output the Traceability Matrix in linear format.
- End with a one-line summary: `Total: N test cases across M stories (P0: X | P1: Y | P2: Z)`.

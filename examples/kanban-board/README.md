# Kanban Board Example - Plyson Actions Showcase

This project demonstrates how to use **Custom Actions** in Plyson to handle complex workflows like authentication and data setup using external services (Clerk).

## Overview

The Kanban Board example showcases:
- **Custom Actions**: Using `@clerk/backend` to programmatically manage users during the test lifecycle.
- **Lifecycle Hooks**: Using `beforeAll` and `afterAll` in test suites to setup and teardown test data.
- **Variable Generation**: Using `$gen` to create unique test data (e.g., dynamic emails).
- **Schema Validation**: Validating API responses against JSON schemas.
- **Playwright Integration**: Running Plyson test suites through the Playwright runner.

## Project Structure

- `actions/`: TypeScript functions that extend Plyson's capabilities.
  - `clerk-signup.action.ts`: Creates a new user in Clerk and stores the JWT.
  - `clerk-login.action.ts`: Authenticates an existing user and retrieves a session token.
  - `clerk-delete.action.ts`: Cleans up the test user from Clerk.
- `suites/`: Test definitions.
  - `board.test.json`: A functional test suite for creating boards.
  - `plyson.spec.ts`: The Playwright entry point that bootstraps Plyson tests.
- `schemas/`: Domain-specific JSON schemas for `boards`, `columns`, and `tasks`.
- `Project-schema/`: Core Plyson schemas used for validation and IDE support.
- `environments/`: Environment-specific configurations.

## Setup

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```

2. **Environment Variables**:
   Ensure you have the following variables available in your environment or store:
   - `CLERK_SECRET_KEY`: Your Clerk Secret Key for backend operations.
   - `SUPABASE_ANON_KEY`: The anonymous key for your Supabase instance.

3. **Environment Config**:
   The project uses `environments/prod.env.json`. Update the `baseUrl` and `specUrl` if necessary.

## Running Tests

You can run the tests using the Plyson CLI:

```bash
# Run all tests in the project
pnpm plyson run

# Or run using Playwright directly
npx playwright test
```

## How it Works

1. **Setup Phase**: In `board.test.json`, the `beforeAll` hook triggers the `clerk-signup` action.
2. **Action Execution**: The action interacts with Clerk, creates a user, and sets `USER_ID` and `API_KEY` in the global store.
3. **Test Execution**: The test cases use `{{API_KEY}}` and `{{USER_ID}}` from the store to make authenticated requests to the Kanban API.
4. **Validation**: Responses are automatically validated against the `boards` schema defined in `schemas/`.
5. **Teardown Phase**: The `afterAll` hook triggers `clerk-delete` to keep your Clerk instance clean.

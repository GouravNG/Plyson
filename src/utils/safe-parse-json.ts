import type { APIResponse } from '@playwright/test'

/**
 * Safely parses the response body as JSON.
 * If Content-Type is not application/json or parsing fails, returns raw text.
 */
export async function safeParseJson(response: APIResponse): Promise<unknown> {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

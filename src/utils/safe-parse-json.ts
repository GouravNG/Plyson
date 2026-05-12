import { APIResponse } from '@playwright/test'

/**
 * Safely parses the response body as JSON.
 * If Content-Type is not application/json or parsing fails, returns raw text.
 */
export async function safeParseJson(response: APIResponse): Promise<unknown> {
  const ct = response.headers()['content-type'] ?? ''
  if (!ct.includes('application/json')) return response.text()
  try {
    return await response.json()
  } catch {
    return response.text() // content-type said JSON but body wasn't — degrade gracefully
  }
}

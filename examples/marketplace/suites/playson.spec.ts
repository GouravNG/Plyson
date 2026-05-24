import { bootstrap } from '@playson/test'
import { expect, test } from '@playwright/test'

/**
 * This is the entry point for playson tests.
 * It discovers all *.test.json files and registers them as Playwright tests.
 */
await bootstrap(test, expect)

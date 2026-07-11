import { expect, test } from '@playwright/test'
import { bootstrap } from '@plyson/test'

/**
 * This is the entry point for plyson tests.
 * It discovers all *.test.json files and registers them as Playwright tests.
 */
await bootstrap(test, expect)

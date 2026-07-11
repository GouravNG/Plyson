import { expect, test as teardown } from '@playwright/test'
import { bootstrapTeardown } from '@plyson/test'

/**
 * This is the entry point for plyson global teardown.
 * It runs project.json afterAll hooks.
 */
await bootstrapTeardown(teardown, expect)

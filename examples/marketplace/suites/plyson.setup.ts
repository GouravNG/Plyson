import { test as setup, expect } from '@playwright/test';
import { bootstrapSetup } from '@plyson/test';

/**
 * This is the entry point for plyson global setup.
 * It runs project.json beforeAll hooks and persists state.
 */
await bootstrapSetup(setup, expect);

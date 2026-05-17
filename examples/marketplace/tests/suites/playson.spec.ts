import { test, expect } from '@playwright/test';
import { bootstrap } from 'play-son';

/**
 * This is the entry point for play-son tests. 
 * It discovers all *.test.json files and registers them as Playwright tests.
 */
await bootstrap(test, expect);

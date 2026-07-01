import { defineWorkspace } from 'vitest/config';

/**
 * Single-owner glob workspace registry.
 * All test projects are defined here; sessions never edit this file.
 * The integration project globs every *.test.ts under tests/.
 */
export default defineWorkspace(['vitest.config.ts']);

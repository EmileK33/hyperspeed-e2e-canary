/**
 * Integration harness smoke tests — Phase 0.
 *
 * These tests are deliberately phase-safe: they verify the harness,
 * fixtures, and toolchain only.  They do NOT probe any feature endpoint
 * or import from src/ modules that belong to later phases.
 *
 * Full endpoint boot-and-hit probes live in the terminal boot-gate that
 * runs after all route sessions have merged.
 */
import { describe, it, expect } from 'vitest';
import {
  getTestContext,
  hasDatabase,
  makeFixture,
  TEST_DATABASE_URL,
} from './fixtures.js';

describe('integration harness — Phase 0 smoke', () => {
  it('arithmetic works (toolchain sanity)', () => {
    expect(1 + 1).toBe(2);
  });

  it('fixtures module is importable', () => {
    expect(typeof TEST_DATABASE_URL).toBe('string');
  });

  it('getTestContext returns expected shape', () => {
    const ctx = getTestContext();
    expect(ctx).toHaveProperty('databaseUrl');
    expect(ctx).toHaveProperty('hasDb');
    expect(typeof ctx.databaseUrl).toBe('string');
    expect(typeof ctx.hasDb).toBe('boolean');
  });

  it('hasDatabase() agrees with TEST_DATABASE_URL', () => {
    const expected = Boolean(TEST_DATABASE_URL);
    expect(hasDatabase()).toBe(expected);
  });

  it('makeFixture() returns seed/cleanup no-ops', async () => {
    const fixture = makeFixture();
    expect(typeof fixture.seed).toBe('function');
    expect(typeof fixture.cleanup).toBe('function');
    // Should not throw even without a DB
    await expect(fixture.seed()).resolves.toBeUndefined();
    await expect(fixture.cleanup()).resolves.toBeUndefined();
  });
});

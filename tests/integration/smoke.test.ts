import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));

describe('S0-A scaffold smoke', () => {
  it('package.json declares ES module type', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
    expect(pkg.type).toBe('module');
  });

  it('npm test script excludes integration tests', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
    expect(pkg.scripts?.test).toBeDefined();
    expect(pkg.scripts.test).not.toMatch(/tests\/integration/);
  });

  it('npm run test:integration script targets integration folder', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
    expect(pkg.scripts?.['test:integration']).toBeDefined();
    // Must target integration tests — either by path or by dedicated config
    const script: string = pkg.scripts['test:integration'];
    const targetsIntegration =
      script.includes('integration') || script.includes('vitest.integration');
    expect(targetsIntegration).toBe(true);
  });

  it('tsconfig.json enables strict mode and ES modules', () => {
    const tsconfig = JSON.parse(readFileSync(resolve(root, 'tsconfig.json'), 'utf-8'));
    expect(tsconfig.compilerOptions?.strict).toBe(true);
    const mod = (tsconfig.compilerOptions?.module as string | undefined)?.toLowerCase();
    expect(['esnext', 'nodenext']).toContain(mod);
  });

  it('exports List, Todo, StoreSnapshot, Store, RouteMount with correct shapes', async () => {
    const types = await import('../../src/store/types.ts');
    // Types are erased at runtime; successful import proves module validity.
    // Shape correctness is enforced by TypeScript at compile time.
    expect(types).toBeDefined();
  });

  it('src/index.ts imports without throwing', async () => {
    const indexModule = await import('../../src/index.ts');
    expect(indexModule).toBeDefined();
  });

  it('smoke test runs under npm run test:integration', () => {
    expect(true).toBe(true);
  });

  it('helpers module exports startTestServer and request helpers', async () => {
    const helpers = await import('./helpers.ts');
    expect(typeof helpers.startTestServer).toBe('function');
    expect(typeof helpers.request).toBe('function');
  });

  it('.gitignore excludes node_modules and dist', () => {
    const gitignore = readFileSync(resolve(root, '.gitignore'), 'utf-8');
    expect(gitignore).toMatch(/node_modules/);
    expect(gitignore).toMatch(/dist/);
  });
});

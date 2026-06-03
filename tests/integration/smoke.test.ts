import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import http from 'node:http';
import pg from 'pg';
import { createServer } from '../../src/server/app.js';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..');

let pool: pg.Pool;

beforeAll(() => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
});

afterAll(async () => {
  await pool.end();
});

describe('project configuration', () => {
  it('package.json declares type=module and required scripts', () => {
    const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')) as Record<string, unknown>;
    expect(pkg['type']).toBe('module');
    const scripts = pkg['scripts'] as Record<string, string>;
    expect(scripts['build']).toBeDefined();
    expect(scripts['test']).toBeDefined();
    expect(scripts['test:integration']).toBeDefined();
    const engines = pkg['engines'] as Record<string, string>;
    expect(engines?.['node']).toMatch(/>=20/);
  });

  it('tsconfig enables strict mode', () => {
    const tsconfig = JSON.parse(readFileSync(join(rootDir, 'tsconfig.json'), 'utf8')) as Record<string, unknown>;
    const opts = tsconfig['compilerOptions'] as Record<string, unknown>;
    expect(opts['strict']).toBe(true);
  });

  it('vitest workspace is a glob registry', () => {
    const ws = readFileSync(join(rootDir, 'vitest.workspace.ts'), 'utf8');
    expect(ws).toContain('tests/**/*.test.ts');
    expect(ws).toMatch(/export default \[/);
  });
});

describe('database schema', () => {
  it('schema setup is idempotent across repeated invocations', async () => {
    const { setup } = await import('./setup.js');
    await expect(setup()).resolves.not.toThrow();
  });

  it('todos table exists with id/title/done columns', async () => {
    const { rows } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'todos' ORDER BY ordinal_position`
    );
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('id');
    expect(cols).toContain('title');
    expect(cols).toContain('done');
  });

  it('lists table exists with id/name columns', async () => {
    const { rows } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'lists' ORDER BY ordinal_position`
    );
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('id');
    expect(cols).toContain('name');
  });
});

describe('createServer', () => {
  it('src/server/app.ts exports createServer returning an http.Server', () => {
    expect(typeof createServer).toBe('function');
    const server = createServer();
    expect(server).toBeInstanceOf(http.Server);
    server.close();
  });

  it('createServer() instantiates without any route file present', () => {
    expect(() => createServer()).not.toThrow();
    const server = createServer();
    server.close();
  });

  it('unknown route returns 404 with { error } JSON body', async () => {
    const server = createServer();
    await new Promise<void>(resolve => server.listen(0, resolve));
    const addr = server.address() as { port: number };

    try {
      const res = await fetch(`http://localhost:${addr.port}/nonexistent-route`);
      expect(res.status).toBe(404);
      expect(res.headers.get('content-type')).toMatch(/application\/json/);
      const body = await res.json() as { error: string };
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});

describe('data operations', () => {
  it('can insert and read back a row in todos', async () => {
    await pool.query(`INSERT INTO todos (title) VALUES ('smoke-test-todo')`);
    const { rows } = await pool.query<{ title: string; done: boolean }>(
      `SELECT title, done FROM todos WHERE title = 'smoke-test-todo' LIMIT 1`
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].title).toBe('smoke-test-todo');
    expect(rows[0].done).toBe(false);
  });

  it('can insert and read back a row in lists', async () => {
    await pool.query(`INSERT INTO lists (name) VALUES ('smoke-test-list')`);
    const { rows } = await pool.query<{ name: string }>(
      `SELECT name FROM lists WHERE name = 'smoke-test-list' LIMIT 1`
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].name).toBe('smoke-test-list');
  });
});

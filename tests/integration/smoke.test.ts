/**
 * Integration harness smoke tests — phase-safe.
 *
 * These tests run after EVERY wave, including integration-0 before any feature
 * routes exist.  They verify:
 *   • the harness itself boots (vitest is configured correctly)
 *   • ephemeral HTTP servers work (port-0 idiom used by later tests)
 *   • fixture helpers are importable and have the expected API surface
 *   • Postgres connectivity when DATABASE_URL is set (CI + local with Docker)
 *
 * They do NOT probe the full future endpoint surface — that is the terminal
 * boot-and-hit gate's job after every feature session has merged.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { getDb, teardown } from './fixtures.js';

afterAll(async () => {
  await teardown().catch(() => {});
});

// ---------------------------------------------------------------------------
// 1. Basic harness sanity
// ---------------------------------------------------------------------------

describe('harness sanity', () => {
  it('arithmetic works', () => {
    expect(1 + 1).toBe(2);
  });

  it('async/await works', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// 2. Ephemeral HTTP server (port 0) — validates the pattern used in later tests
// ---------------------------------------------------------------------------

describe('ephemeral HTTP server', () => {
  it('listens on a dynamic port and responds to requests', async () => {
    const server = createServer(
      (_req: IncomingMessage, res: ServerResponse) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, phase: 0 }));
      },
    );

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    const addr = server.address() as { address: string; port: number };
    expect(addr.port).toBeGreaterThan(0);
    expect(addr.port).toBeLessThanOrEqual(65535);

    const res = await fetch(`http://127.0.0.1:${addr.port}/`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { ok: boolean; phase: number };
    expect(body.ok).toBe(true);
    expect(body.phase).toBe(0);

    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it('two servers on port 0 get different ports', async () => {
    const mkServer = () =>
      new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
        const s = createServer();
        s.listen(0, '127.0.0.1', () => {
          const { port } = s.address() as { port: number };
          resolve({
            port,
            close: () =>
              new Promise<void>((res, rej) =>
                s.close((e) => (e ? rej(e) : res())),
              ),
          });
        });
      });

    const [a, b] = await Promise.all([mkServer(), mkServer()]);
    expect(a.port).not.toBe(b.port);
    await Promise.all([a.close(), b.close()]);
  });
});

// ---------------------------------------------------------------------------
// 3. Fixture helper API surface
// ---------------------------------------------------------------------------

describe('fixture helpers', () => {
  it('exports getDb as a function', () => {
    expect(typeof getDb).toBe('function');
  });

  it('exports teardown as a function', () => {
    expect(typeof teardown).toBe('function');
  });

  it('teardown is idempotent when pool was never opened', async () => {
    // Safe to call before any DB use — should not throw.
    await expect(teardown()).resolves.toBeUndefined();
    await expect(teardown()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Postgres connectivity — only when DATABASE_URL is available
// ---------------------------------------------------------------------------

describe('Postgres connectivity', () => {
  const hasDb = Boolean(process.env.DATABASE_URL);

  it.skipIf(!hasDb)(
    'connects and executes a trivial query',
    async () => {
      const db = await getDb();
      const result = await db.query<{ n: number }>('SELECT 1 AS n');
      expect(result.rows).toHaveLength(1);
      expect(Number(result.rows[0].n)).toBe(1);
    },
  );

  it.skipIf(!hasDb)(
    'pool is reused across calls to getDb()',
    async () => {
      const db1 = await getDb();
      const db2 = await getDb();
      expect(db1).toBe(db2);
    },
  );
});

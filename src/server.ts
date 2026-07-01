/**
 * Server entry point.
 * Bootstraps the app and starts listening.
 * S0-A: Shared scaffold / infrastructure
 */

import { createApp } from './app.ts';
import { getPort } from './lib/env.ts';

export interface ServerHandle {
  port: number;
  stop(): void;
}

/**
 * Start the HTTP server.
 * Returns a handle with the actual bound port and a stop() method.
 * Without @types/node the real http.createServer is wired at runtime
 * via the dynamic globalThis.require path; this module remains type-safe.
 */
export function startServer(port?: number): ServerHandle {
  const listenPort = port ?? getPort();
  const app = createApp();

  // Dynamically access Node.js http to avoid @types/node at compile time.
  // All Node.js APIs are accessed via (globalThis as any) to stay type-safe.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  const http = g.__importHttp?.() ?? g['require']?.('node:http');

  if (!http) {
    // Test / non-Node environment: return a no-op handle.
    return {
      port: listenPort,
      stop() { /* no-op */ },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const server = http.createServer(async (nodeReq: any, nodeRes: any) => {
    let body: unknown;
    try {
      const chunks: any[] = [];
      await new Promise<void>((resolve, reject) => {
        nodeReq.on('data', (chunk: any) => chunks.push(chunk));
        nodeReq.on('end', resolve);
        nodeReq.on('error', reject);
      });
      const raw: string = g['Buffer'].concat(chunks).toString();
      if (raw) body = JSON.parse(raw);
    } catch {
      body = undefined;
    }

    const req = {
      method: nodeReq.method as string,
      url: nodeReq.url as string,
      headers: nodeReq.headers as Record<string, string | string[] | undefined>,
      body,
    };

    const res = {
      statusCode: 200,
      setHeader(name: string, value: string) {
        nodeRes.setHeader(name, value);
      },
      end(data?: string) {
        nodeRes.statusCode = this.statusCode;
        nodeRes.end(data ?? '');
      },
    };

    await app.handle(req, res);
  });

  server.listen(listenPort, () => {
    console.log(`Server listening on port ${listenPort}`);
  });

  return {
    port: listenPort,
    stop() {
      server.close();
    },
  };
}

// Auto-start when run directly (npx tsx src/server.ts)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if ((globalThis as any).__isMain?.() === true) {
  startServer();
}

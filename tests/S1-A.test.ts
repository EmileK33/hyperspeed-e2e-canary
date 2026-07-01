/**
 * S1-A independent test - src/server/app.ts
 */

import { describe, it, expect, afterEach } from "vitest";
import type { Server } from "node:http";
import { createServer } from "../src/server/app.ts";
import type { Route } from "../src/types/contracts.ts";

async function startServer(routes: Route[] = []): Promise<{ url: string; close: () => Promise<void>; server: Server }> {
  const server = createServer(routes);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("bad address");
  const url = `http://127.0.0.1:${addr.port}`;
  const close = (): Promise<void> =>
    new Promise((res, rej) => server.close((e) => (e ? rej(e) : res())));
  return { url, close, server };
}

describe("createServer export", () => {
  it("is exported as a function", () => {
    expect(typeof createServer).toBe("function");
  });

  it("returns a node http.Server", () => {
    const server = createServer();
    expect(server).toBeTruthy();
    expect(typeof server.listen).toBe("function");
    expect(typeof server.close).toBe("function");
  });
});

describe("404 fallback (AC-2)", () => {
  let closeServer: (() => Promise<void>) | undefined;
  afterEach(async () => { await closeServer?.(); closeServer = undefined; });

  it("returns 404 for unregistered route", async () => {
    const { url, close } = await startServer();
    closeServer = close;
    const res = await fetch(`${url}/no-such-path`);
    expect(res.status).toBe(404);
  });

  it("404 body is valid JSON with error field", async () => {
    const { url, close } = await startServer();
    closeServer = close;
    const res = await fetch(`${url}/nonexistent`);
    const body = await res.json() as { error: string };
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });

  it("404 Content-Type is application/json", async () => {
    const { url, close } = await startServer();
    closeServer = close;
    const res = await fetch(`${url}/missing`);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("method mismatch returns 404", async () => {
    const route: Route = {
      method: "GET",
      path: "/ping",
      handler: async () => ({ status: 200, body: { ok: true } }),
    };
    const { url, close } = await startServer([route]);
    closeServer = close;
    const res = await fetch(`${url}/ping`, { method: "POST" });
    expect(res.status).toBe(404);
  });
});

describe("JSON body parsing (AC-1)", () => {
  let closeServer: (() => Promise<void>) | undefined;
  afterEach(async () => { await closeServer?.(); closeServer = undefined; });

  it("parses JSON body and passes to handler", async () => {
    let received: unknown;
    const route: Route = {
      method: "POST",
      path: "/echo",
      handler: async (ctx) => {
        received = ctx.body;
        return { status: 201, body: ctx.body };
      },
    };
    const { url, close } = await startServer([route]);
    closeServer = close;
    const payload = { title: "Buy milk", done: false };
    const res = await fetch(`${url}/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(201);
    expect(received).toEqual(payload);
  });

  it("body is undefined without application/json content-type", async () => {
    let received: unknown = "sentinel";
    const route: Route = {
      method: "POST",
      path: "/check",
      handler: async (ctx) => {
        received = ctx.body;
        return { status: 200, body: null };
      },
    };
    const { url, close } = await startServer([route]);
    closeServer = close;
    await fetch(`${url}/check`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hello",
    });
    expect(received).toBeUndefined();
  });

  it("response body is JSON-serialised to client", async () => {
    const route: Route = {
      method: "GET",
      path: "/data",
      handler: async () => ({ status: 200, body: { items: [1, 2, 3] } }),
    };
    const { url, close } = await startServer([route]);
    closeServer = close;
    const res = await fetch(`${url}/data`);
    const body = await res.json() as { items: number[] };
    expect(body.items).toEqual([1, 2, 3]);
  });
});

describe("route dispatch", () => {
  let closeServer: (() => Promise<void>) | undefined;
  afterEach(async () => { await closeServer?.(); closeServer = undefined; });

  it("dispatches GET to handler", async () => {
    const route: Route = {
      method: "GET",
      path: "/ping",
      handler: async () => ({ status: 200, body: { pong: true } }),
    };
    const { url, close } = await startServer([route]);
    closeServer = close;
    const res = await fetch(`${url}/ping`);
    expect(res.status).toBe(200);
    const body = await res.json() as { pong: boolean };
    expect(body.pong).toBe(true);
  });

  it("extracts path params into ctx.params", async () => {
    let capturedId: string | undefined;
    const route: Route = {
      method: "GET",
      path: "/todos/:id",
      handler: async (ctx) => {
        capturedId = ctx.params["id"];
        return { status: 200, body: { id: ctx.params["id"] } };
      },
    };
    const { url, close } = await startServer([route]);
    closeServer = close;
    const res = await fetch(`${url}/todos/42`);
    expect(res.status).toBe(200);
    expect(capturedId).toBe("42");
  });

  it("extracts query params into ctx.query", async () => {
    let capturedQuery: Record<string, string> = {};
    const route: Route = {
      method: "GET",
      path: "/search",
      handler: async (ctx) => {
        capturedQuery = ctx.query;
        return { status: 200, body: null };
      },
    };
    const { url, close } = await startServer([route]);
    closeServer = close;
    await fetch(`${url}/search?q=hello&limit=10`);
    expect(capturedQuery["q"]).toBe("hello");
    expect(capturedQuery["limit"]).toBe("10");
  });

  it("handler error returns 500 JSON", async () => {
    const route: Route = {
      method: "GET",
      path: "/boom",
      handler: async () => { throw new Error("exploded"); },
    };
    const { url, close } = await startServer([route]);
    closeServer = close;
    const res = await fetch(`${url}/boom`);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("exploded");
  });

  it("supports multi-segment path params /todos/:id/toggle", async () => {
    let capturedId: string | undefined;
    const route: Route = {
      method: "POST",
      path: "/todos/:id/toggle",
      handler: async (ctx) => {
        capturedId = ctx.params["id"];
        return { status: 200, body: { toggled: ctx.params["id"] } };
      },
    };
    const { url, close } = await startServer([route]);
    closeServer = close;
    const res = await fetch(`${url}/todos/7/toggle`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(capturedId).toBe("7");
  });

  it("dispatches multiple routes independently", async () => {
    const routes: Route[] = [
      { method: "GET", path: "/a", handler: async () => ({ status: 200, body: { which: "a" } }) },
      { method: "GET", path: "/b", handler: async () => ({ status: 200, body: { which: "b" } }) },
    ];
    const { url, close } = await startServer(routes);
    closeServer = close;
    const ra = await (await fetch(`${url}/a`)).json() as { which: string };
    const rb = await (await fetch(`${url}/b`)).json() as { which: string };
    expect(ra.which).toBe("a");
    expect(rb.which).toBe("b");
  });
});

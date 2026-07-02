/**
 * S2-D independent tests — Todos endpoints (US-003)
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { createServer } from "../src/app.ts";
import { clearRoutes } from "../src/routes/index.ts";
import { _setPool } from "../src/db/pool.ts";

type ServerHandle = Awaited<ReturnType<typeof createServer>>;

interface BoundServer {
  server: ServerHandle;
  port: number;
  baseUrl: string;
}

async function startServer(): Promise<BoundServer> {
  const server = await createServer();
  return new Promise((resolve, reject) => {
    (server as unknown as { listen(port: number, cb: () => void): void })
      .listen(0, () => {
        const addr = (server as unknown as { address(): { port: number } | null }).address?.() ?? null;
        const port = addr ? addr.port : 0;
        resolve({ server, port, baseUrl: "http://127.0.0.1:" + port });
      });
    server.on("error", reject);
  });
}

async function stopServer(s: ServerHandle): Promise<void> {
  return new Promise((resolve) => {
    (s as unknown as { close(cb: () => void): void }).close(() => resolve());
  });
}

let mockRows: Array<{ id: number; title: string; done: boolean }> = [];
let nextId = 1;

function makeMockPool() {
  return {
    query: vi.fn(async (text: string, values?: unknown[]) => {
      const sql = text.trim().toUpperCase();

      if (sql.startsWith("INSERT INTO TODOS")) {
        const title = values?.[0] as string;
        const row = { id: nextId++, title, done: false };
        mockRows.push(row);
        return { rows: [row], rowCount: 1 };
      }

      if (sql.startsWith("SELECT") && sql.includes("WHERE ID")) {
        const id = values?.[0] as number;
        const row = mockRows.find((r) => r.id === id);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      if (sql.startsWith("SELECT")) {
        return { rows: [...mockRows], rowCount: mockRows.length };
      }

      if (sql.startsWith("UPDATE TODOS")) {
        const id = values?.[0] as number;
        const row = mockRows.find((r) => r.id === id);
        if (!row) return { rows: [], rowCount: 0 };
        row.done = !row.done;
        return { rows: [row], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    }),
    end: vi.fn(async () => {}),
  };
}

let bound: BoundServer | null = null;

async function setup(): Promise<BoundServer> {
  clearRoutes();
  mockRows = [];
  nextId = 1;
  _setPool(makeMockPool());

  const { todosRouter } = await import("../src/routes/todos.ts");
  todosRouter();

  return startServer();
}

afterEach(async () => {
  if (bound) {
    await stopServer(bound.server);
    bound = null;
  }
  clearRoutes();
  _setPool(null);
});

describe("src/routes/todos.ts — todosRouter export", () => {
  it("exports todosRouter as a function", async () => {
    const { todosRouter } = await import("../src/routes/todos.ts");
    expect(typeof todosRouter).toBe("function");
  });

  it("todosRouter() returns an array with the todos routes", async () => {
    clearRoutes();
    const { todosRouter } = await import("../src/routes/todos.ts");
    const routes = todosRouter();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.some(r => r.method === "GET" && r.path === "/todos")).toBe(true);
    expect(routes.some(r => r.method === "POST" && r.path === "/todos")).toBe(true);
    expect(routes.some(r => r.method === "POST" && r.path === "/todos/:id/toggle")).toBe(true);
  });
});

describe("US-003 — GET /todos", () => {
  it("returns 200 with an empty array when no todos exist", async () => {
    bound = await setup();
    const res = await fetch(bound.baseUrl + "/todos");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it("returns 200 with existing todos", async () => {
    bound = await setup();
    await fetch(bound.baseUrl + "/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test todo" }),
    });
    const res = await fetch(bound.baseUrl + "/todos");
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ id: number; title: string; done: boolean }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Test todo");
    expect(body[0].done).toBe(false);
  });

  it("returns JSON content-type", async () => {
    bound = await setup();
    const res = await fetch(bound.baseUrl + "/todos");
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });
});

describe("US-003 — POST /todos", () => {
  it("returns 201 with created todo", async () => {
    bound = await setup();
    const res = await fetch(bound.baseUrl + "/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Buy milk" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: number; title: string; done: boolean };
    expect(body.title).toBe("Buy milk");
    expect(body.done).toBe(false);
    expect(typeof body.id).toBe("number");
  });

  it("returns 400 when title is missing", async () => {
    bound = await setup();
    const res = await fetch(bound.baseUrl + "/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBeTruthy();
  });

  it("returns 400 when title is empty string", async () => {
    bound = await setup();
    const res = await fetch(bound.baseUrl + "/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "   " }),
    });
    expect(res.status).toBe(400);
  });
});

describe("US-003 — POST /todos/:id/toggle", () => {
  it("returns 200 with toggled todo (done: true)", async () => {
    bound = await setup();
    const createRes = await fetch(bound.baseUrl + "/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Toggle me" }),
    });
    const created = await createRes.json() as { id: number; title: string; done: boolean };
    const res = await fetch(bound.baseUrl + "/todos/" + created.id + "/toggle", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { id: number; title: string; done: boolean };
    expect(body.done).toBe(true);
    expect(body.id).toBe(created.id);
  });

  it("returns 404 when todo does not exist", async () => {
    bound = await setup();
    const res = await fetch(bound.baseUrl + "/todos/9999/toggle", {
      method: "POST",
    });
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBeTruthy();
  });

  it("can toggle a todo back to done: false", async () => {
    bound = await setup();
    const createRes = await fetch(bound.baseUrl + "/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Toggle twice" }),
    });
    const created = await createRes.json() as { id: number };
    await fetch(bound.baseUrl + "/todos/" + created.id + "/toggle", { method: "POST" });
    const res = await fetch(bound.baseUrl + "/todos/" + created.id + "/toggle", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json() as { done: boolean };
    expect(body.done).toBe(false);
  });
});

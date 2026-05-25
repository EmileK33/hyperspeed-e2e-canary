import http from 'node:http';

export interface TestServer {
  baseUrl: string;
  close(): Promise<void>;
}

export async function startTestServer(handler: http.RequestListener): Promise<TestServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise((res, rej) =>
            server.close((err) => (err ? rej(err) : res()))
          ),
      });
    });
  });
}

export async function request(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const url = new URL(path, baseUrl);
  return new Promise((resolve, reject) => {
    const opts: http.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers:
        body !== undefined ? { 'Content-Type': 'application/json' } : {},
    };
    const req = http.request(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk as Buffer));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
        resolve({ status: res.statusCode ?? 0, body: parsed });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

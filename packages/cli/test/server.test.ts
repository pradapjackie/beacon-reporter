import { mkdtemp, writeFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { serveReport } from '../src/server';

function rawGet(
  url: string,
  headers: Record<string, string>,
): Promise<{ headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, { headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
      })
      .on('error', reject);
  });
}

const closers: Array<() => void> = [];
afterAll(() => {
  for (const close of closers) close();
});

async function startServer() {
  const dir = await mkdtemp(path.join(tmpdir(), 'beacon-cli-'));
  await writeFile(path.join(dir, 'index.html'), '<h1>beacon</h1>', 'utf8');
  const server = serveReport(dir, 0);
  closers.push(() => server.close());
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}` };
}

describe('serveReport', () => {
  it('serves files with CORS and gzip', async () => {
    const { base } = await startServer();
    const res = await fetch(`${base}/index.html`, {
      headers: { 'accept-encoding': 'gzip' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toBe('<h1>beacon</h1>');
  });

  it('serves index.html for the root path', async () => {
    const { base } = await startServer();
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<h1>beacon</h1>');
  });

  it('rejects path traversal', async () => {
    const { base } = await startServer();
    const res = await fetch(`${base}/..%2f..%2fetc%2fpasswd`);
    expect([403, 404]).toContain(res.status);
  });

  it('gzips text assets for gzip clients and serves identity otherwise', async () => {
    const { base } = await startServer();
    // fetch() auto-decompresses, so use raw http requests to see the wire format.
    const gzipped = await rawGet(`${base}/index.html`, { 'accept-encoding': 'gzip' });
    expect(gzipped.headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(gzipped.body).toString('utf8')).toBe('<h1>beacon</h1>');

    const plain = await rawGet(`${base}/index.html`, {});
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(plain.body.toString('utf8')).toBe('<h1>beacon</h1>');
  });
});

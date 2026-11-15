import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fetchPreviousCatalog, restorePreviousCatalog } from '../src/publish/previous';

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

let catalog = {
  schemaVersion: 1,
  generatedAt: '2026-01-01T00:00:00.000Z',
  sources: [{ kind: 'models.dev' }],
  organizations: [{ id: 'anthropic', status: 'active' }],
  families: [],
  models: [{ id: 'anthropic/claude-opus-4.5', status: 'active' }],
  releases: [],
  pointers: [{ id: 'anthropic/claude-latest', history: [] }],
  vendors: [{ id: 'anthropic', status: 'active' }],
  endpoints: [],
  offerings: [
    {
      id: 'anthropic:claude-opus-4-5',
      status: 'active',
      firstSeenAt: '2025-11-01T00:00:00.000Z',
      pricing: { text: { input: 5, output: 25 } }
    }
  ],
  names: [
    {
      id: 'anthropic:claude-opus-4-5',
      status: 'live',
      firstSeenAt: '2025-11-01T00:00:00.000Z',
      history: []
    }
  ],
  agents: [{ id: 'claude-code' }]
};

let gzipped = (value: unknown) => gzipSync(JSON.stringify(value));

let server: http.Server;
let siteUrl: string;
let handler: Handler;
let requests: string[];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    requests.push(req.url ?? '');
    handler(req, res);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  siteUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});

beforeEach(() => {
  requests = [];
  handler = (_req, res) => res.writeHead(500).end();
});

let serve = (body: Buffer | string, headers: http.OutgoingHttpHeaders = {}) => {
  handler = (_req, res) =>
    res
      .writeHead(200, {
        'content-type': 'application/gzip',
        'content-length': Buffer.byteLength(body),
        ...headers
      })
      .end(body);
};

let reasonFor = async (opts: Parameters<typeof fetchPreviousCatalog>[1] = {}) => {
  let result = await fetchPreviousCatalog(siteUrl, opts);
  expect(result.ok).toBe(false);
  return result.ok ? '' : result.reason;
};

describe('fetchPreviousCatalog', () => {
  it('downloads, unzips and validates the live catalog', async () => {
    serve(gzipped(catalog));

    let result = await fetchPreviousCatalog(siteUrl);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.catalog).toEqual(catalog);
    expect(JSON.parse(result.json)).toEqual(catalog);
    expect(requests[0]).toMatch(/^\/catalog\.json\.gz\?t=\d+$/);
  });

  it('accepts a body the transport already decompressed', async () => {
    serve(JSON.stringify(catalog), { 'content-type': 'application/json' });

    let result = await fetchPreviousCatalog(siteUrl);

    expect(result.ok && result.catalog.offerings).toEqual(catalog.offerings);
  });

  it('keeps fields the validator does not know about', async () => {
    let extended = { ...catalog, extra: { kept: true } };
    serve(gzipped(extended));

    let result = await fetchPreviousCatalog(siteUrl);

    expect(result.ok && JSON.parse(result.json).extra).toEqual({ kept: true });
  });

  it('treats an HTTP error as missing', async () => {
    handler = (_req, res) => res.writeHead(503).end('down');

    expect(await reasonFor()).toMatch(/^HTTP 503 from /);
  });

  it('times out when the server does not answer', async () => {
    handler = () => {};

    expect(await reasonFor({ timeoutMs: 200 })).toBe('timed out after 200ms');
  });

  it('times out when the body stalls', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/gzip' });
      res.write(gzipped(catalog).subarray(0, 10));
    };

    expect(await reasonFor({ timeoutMs: 300 })).toBe('timed out after 300ms');
  });

  it('rejects a declared size over the cap', async () => {
    serve(gzipped(catalog));

    expect(await reasonFor({ maxBytes: 10 })).toMatch(/^response is \d+ bytes, over 10$/);
  });

  it('rejects a streamed body over the cap', async () => {
    let body = gzipped(catalog);
    handler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/gzip' });
      res.write(body.subarray(0, 20));
      res.end(body.subarray(20));
    };

    expect(await reasonFor({ maxBytes: 20 })).toBe('response is over 20 bytes');
  });

  it('rejects a catalog that unzips past the raw cap', async () => {
    serve(gzipped(catalog));

    expect(await reasonFor({ maxRawBytes: 100 })).toMatch(/100/);
  });

  it('rejects a body that is neither gzip nor JSON', async () => {
    serve(Buffer.from([0x1f, 0x8b, 0, 1, 2, 3]));

    expect(await reasonFor()).not.toBe('');
  });

  it('rejects a catalog with the wrong shape', async () => {
    let { names: _names, ...withoutNames } = catalog;
    serve(gzipped(withoutNames));

    expect(await reasonFor()).toMatch(/^previous catalog: names/);
  });

  it('rejects a catalog from another schema version', async () => {
    serve(gzipped({ ...catalog, schemaVersion: 2 }));

    expect(await reasonFor()).toMatch(/^previous catalog: schemaVersion/);
  });

  it('rejects a catalog without offerings', async () => {
    serve(gzipped({ ...catalog, offerings: [] }));

    expect(await reasonFor()).toBe('previous catalog has no offerings');
  });

  it('uses an injected fetch', async () => {
    let urls: string[] = [];
    let result = await fetchPreviousCatalog('https://models.example.com', {
      fetch: (async (url: string) => {
        urls.push(url);
        return new Response(gzipped(catalog));
      }) as unknown as typeof fetch
    });

    expect(result.ok).toBe(true);
    expect(urls[0]).toMatch(/^https:\/\/models\.example\.com\/catalog\.json\.gz\?t=/);
  });
});

describe('restorePreviousCatalog', () => {
  it('writes the live catalog when the cache had none', async () => {
    let dir = path.join(await mkdtemp(path.join(os.tmpdir(), 'model-catalog-previous-')), 'p');
    serve(gzipped(catalog));

    let restored = await restorePreviousCatalog({ siteUrl, dir });

    expect(restored).toMatchObject({
      status: 'restored',
      generatedAt: catalog.generatedAt,
      offerings: 1
    });
    expect(JSON.parse(await readFile(path.join(dir, 'catalog.json'), 'utf8'))).toEqual(
      catalog
    );
  });

  it('keeps a catalog restored from the cache', async () => {
    let dir = await mkdtemp(path.join(os.tmpdir(), 'model-catalog-previous-'));
    await writeFile(path.join(dir, 'catalog.json'), '{"cached":true}');
    serve(gzipped(catalog));

    let restored = await restorePreviousCatalog({ siteUrl, dir });

    expect(restored.status).toBe('present');
    expect(requests).toEqual([]);
    expect(await readFile(path.join(dir, 'catalog.json'), 'utf8')).toBe('{"cached":true}');
  });

  it('writes nothing when the site is down', async () => {
    let dir = path.join(await mkdtemp(path.join(os.tmpdir(), 'model-catalog-previous-')), 'p');
    handler = (_req, res) => res.writeHead(502).end();

    let restored = await restorePreviousCatalog({ siteUrl, dir });

    expect(restored).toMatchObject({
      status: 'missing',
      reason: expect.stringMatching(/502/)
    });
    expect(existsSync(path.join(dir, 'catalog.json'))).toBe(false);
  });
});

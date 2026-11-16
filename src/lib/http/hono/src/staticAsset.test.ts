import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStaticAssetResponse } from './staticAsset';

let content = 'export let message = "A compressible admin frontend asset";\n'.repeat(2000);

describe('static asset compression', () => {
  let directory: string;
  let filePath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'static-asset-'));
    filePath = join(directory, 'index-hash.js');
    await writeFile(filePath, content);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  let respond = (encoding?: string, method = 'GET', contentType = 'text/javascript') =>
    createStaticAssetResponse(
      new Request('https://admin.example/assets/index-hash.js', {
        method,
        headers: encoding ? { 'Accept-Encoding': encoding } : {}
      }),
      filePath,
      { contentType }
    );

  it.each([
    ['gzip, br', 'br'],
    ['gzip', 'gzip'],
    ['gzip ; q=1', 'gzip'],
    ['br;q=0, gzip;q=1', 'gzip'],
    ['br;q=0.2, gzip;q=1, identity;q=0', 'gzip'],
    ['*;q=1', 'br']
  ])('negotiates and correctly encodes %s as %s', async (accept, encoding) => {
    let response = await respond(accept);
    let body = Buffer.from(await response.arrayBuffer());
    let decoded = encoding === 'br' ? brotliDecompressSync(body) : gunzipSync(body);

    expect(response.headers.get('Content-Encoding')).toBe(encoding);
    expect(response.headers.get('Vary')).toBe('Accept-Encoding');
    expect(response.headers.get('Content-Type')).toBe('text/javascript');
    expect(response.headers.get('Content-Length')).toBe(String(body.byteLength));
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(decoded.toString()).toBe(content);
    expect(body.byteLength).toBeLessThan(Buffer.byteLength(content) / 2);
  });

  it.each([undefined, 'identity', 'br;q=0, gzip;q=0', 'zstd'])(
    'preserves identity fallback for %s',
    async encoding => {
      let response = await respond(encoding);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Encoding')).toBeNull();
      expect(await response.text()).toBe(content);
    }
  );

  it('rejects requests that forbid every available encoding', async () => {
    expect((await respond('br;q=0, gzip;q=0, identity;q=0')).status).toBe(406);
    expect((await respond('*;q=0')).status).toBe(406);
  });

  it('returns the GET representation headers without a body for HEAD', async () => {
    let get = await respond('br');
    let head = await respond('br', 'HEAD');

    expect([...head.headers]).toEqual([...get.headers]);
    expect(await head.text()).toBe('');
  });

  it('does not compress already compressed binary types', async () => {
    let response = await respond('gzip, br', 'GET', 'image/png');

    expect(response.headers.get('Content-Encoding')).toBeNull();
    expect(await response.text()).toBe(content);
  });

  it('invalidates compressed variants when the source changes', async () => {
    await respond('br');
    let updated = content.replaceAll('frontend', 'modified');
    await writeFile(filePath, updated);
    await utimes(filePath, new Date(), new Date(Date.now() + 1000));

    let response = await respond('br');
    expect(brotliDecompressSync(Buffer.from(await response.arrayBuffer())).toString()).toBe(
      updated
    );
  });

  it('serves concurrent requests with independent response bodies', async () => {
    let responses = await Promise.all([respond('br'), respond('br'), respond('gzip')]);
    let bodies = await Promise.all(responses.map(response => response.arrayBuffer()));

    expect(brotliDecompressSync(Buffer.from(bodies[0])).toString()).toBe(content);
    expect(Buffer.from(bodies[0])).toEqual(Buffer.from(bodies[1]));
    expect(gunzipSync(Buffer.from(bodies[2])).toString()).toBe(content);
  });
});

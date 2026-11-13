import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  archiveFile,
  fetchArchive,
  fetchFingerprint,
  fingerprintFile,
  readFingerprint
} from '../source';

let archive = gzipSync(Buffer.from(JSON.stringify({ hello: 'world' })));
let fingerprintBody = JSON.stringify({
  fingerprint: 'fp-1',
  generatedAt: '2026-01-01T00:00:00.000Z'
});
let etag = '"v1"';

describe('file sources', () => {
  let directory: string;
  let baseUrl: string;

  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'groundstation-knowledge-'));
    baseUrl = pathToFileURL(directory).href;

    await writeFile(path.join(directory, fingerprintFile), fingerprintBody);
    await writeFile(path.join(directory, archiveFile), archive);
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('reads the fingerprint without an etag', async () => {
    expect(await fetchFingerprint({ baseUrl, etag })).toEqual({
      status: 'changed',
      fingerprint: 'fp-1',
      etag: null
    });
    expect(await readFingerprint(`${baseUrl}/`)).toBe('fp-1');
  });

  it('reads the archive bytes', async () => {
    expect(Buffer.compare(await fetchArchive(baseUrl), archive)).toBe(0);
  });

  it('rejects a malformed fingerprint', async () => {
    let broken = await mkdtemp(path.join(tmpdir(), 'groundstation-knowledge-'));
    await writeFile(path.join(broken, fingerprintFile), JSON.stringify({ generatedAt: 'x' }));

    await expect(fetchFingerprint({ baseUrl: pathToFileURL(broken).href })).rejects.toThrow(
      /unexpected shape/
    );

    await rm(broken, { recursive: true, force: true });
  });

  it('fails when the files are missing', async () => {
    let missing = pathToFileURL(path.join(directory, 'missing')).href;

    await expect(fetchFingerprint({ baseUrl: missing })).rejects.toThrow();
    await expect(fetchArchive(missing)).rejects.toThrow();
  });
});

describe('http sources', () => {
  let server: Server;
  let origin: string;
  let requests: { url: string; headers: IncomingHttpHeaders }[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      requests.push({ url: request.url!, headers: request.headers });

      if (request.url == `/ok/${fingerprintFile}`) {
        if (request.headers['if-none-match'] == etag) return response.writeHead(304).end();
        return response.writeHead(200, { etag }).end(fingerprintBody);
      }
      if (request.url == `/ok/${archiveFile}`) return response.writeHead(200).end(archive);
      if (request.url == `/stale/${fingerprintFile}`) return response.writeHead(304).end();
      if (request.url == `/huge/${archiveFile}`) {
        response.writeHead(200, { 'content-length': String(65 * 1024 * 1024) });
        return response.write('x');
      }
      if (request.url?.startsWith('/broken/')) return response.writeHead(503).end();

      response.writeHead(404).end();
    });

    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });

  let lastRequest = () => requests.at(-1)!;

  it('returns the fingerprint and etag on 200', async () => {
    let result = await fetchFingerprint({ baseUrl: `${origin}/ok` });

    expect(result).toEqual({ status: 'changed', fingerprint: 'fp-1', etag });
    expect(lastRequest().headers).not.toHaveProperty('if-none-match');
  });

  it('sends the etag and reports a 304 as unchanged', async () => {
    let result = await fetchFingerprint({ baseUrl: `${origin}/ok`, etag });

    expect(result).toEqual({ status: 'unchanged' });
    expect(lastRequest().headers['if-none-match']).toBe(etag);
  });

  it('reads the fingerprint unconditionally', async () => {
    expect(await readFingerprint(`${origin}/ok/`)).toBe('fp-1');
    expect(lastRequest().url).toBe(`/ok/${fingerprintFile}`);

    await expect(readFingerprint(`${origin}/stale`)).rejects.toThrow(/returned 304/);
  });

  it('throws when the fingerprint request fails', async () => {
    await expect(fetchFingerprint({ baseUrl: `${origin}/broken` })).rejects.toThrow(
      /fingerprint request failed with 503/
    );
  });

  it('downloads the archive', async () => {
    let downloaded = await fetchArchive(`${origin}/ok//`);

    expect(Buffer.compare(downloaded, archive)).toBe(0);
    expect(lastRequest().url).toBe(`/ok/${archiveFile}`);
  });

  it('throws when the archive request fails', async () => {
    await expect(fetchArchive(`${origin}/broken`)).rejects.toThrow(
      /archive request failed with 503/
    );
  });

  it('refuses an archive that declares more than the size cap', async () => {
    await expect(fetchArchive(`${origin}/huge`)).rejects.toThrow(/too large/);
  });
});

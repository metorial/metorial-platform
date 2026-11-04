import { gzipSync, zstdCompressSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { createToken, errorCode, ingest, stubStatus } from './support';

let maxBodyBytes = 4 * 1024 * 1024;

let json = '{"resourceLogs":[]}';

describe('ingest request handling', () => {
  let secret: string;

  beforeAll(async () => {
    secret = (await createToken()).secret;
  });

  it('accepts identity, gzip and zstd bodies', async () => {
    let identity = await ingest('/v1/logs', { credential: secret, body: json });

    let gzip = await ingest('/v1/logs', {
      credential: secret,
      headers: { 'content-encoding': 'gzip' },
      body: gzipSync(json)
    });

    let zstd = await ingest('/v1/logs', {
      credential: secret,
      headers: { 'content-encoding': 'zstd' },
      body: zstdCompressSync(json)
    });

    expect(identity.status).toBe(stubStatus);
    expect(gzip.status).toBe(stubStatus);
    expect(zstd.status).toBe(stubStatus);
  });

  it('accepts protobuf and json media types on OTLP routes', async () => {
    for (let contentType of [
      'application/json',
      'application/json; charset=utf-8',
      'application/x-protobuf',
      'application/protobuf'
    ]) {
      let response = await ingest('/v1/logs', {
        credential: secret,
        headers: { 'content-type': contentType }
      });

      expect(response.status, contentType).toBe(stubStatus);
    }
  });

  it('rejects unsupported media types', async () => {
    for (let contentType of ['text/plain', 'application/x-ndjson']) {
      let response = await ingest('/v1/logs', {
        credential: secret,
        headers: { 'content-type': contentType }
      });

      expect(response.status, contentType).toBe(415);
      expect(await errorCode(response), contentType).toBe('unsupported_media_type');
    }

    let missing = await ingest('/v1/logs', {
      credential: secret,
      headers: { 'content-type': '' }
    });

    expect(missing.status).toBe(415);
  });

  it('only accepts ndjson on the bulk route', async () => {
    let ndjson = await ingest('/v1/bulk', {
      credential: secret,
      headers: { 'content-type': 'application/x-ndjson' },
      body: '{"a":1}\n'
    });
    let wrong = await ingest('/v1/bulk', { credential: secret });

    expect(ndjson.status).toBe(stubStatus);
    expect(wrong.status).toBe(415);
  });

  it('rejects unsupported content encodings', async () => {
    for (let encoding of ['br', 'deflate', 'gzip, zstd']) {
      let response = await ingest('/v1/logs', {
        credential: secret,
        headers: { 'content-encoding': encoding }
      });

      expect(response.status, encoding).toBe(415);
      expect(await errorCode(response), encoding).toBe('unsupported_content_encoding');
    }
  });

  it('rejects bodies over the size limit', async () => {
    let response = await ingest('/v1/logs', {
      credential: secret,
      body: new Uint8Array(maxBodyBytes + 1)
    });

    expect(response.status).toBe(413);
  });

  it('accepts a body just under the size limit', async () => {
    let response = await ingest('/v1/logs', {
      credential: secret,
      body: new Uint8Array(maxBodyBytes - 1024)
    });

    expect(response.status).toBe(stubStatus);
  });
});

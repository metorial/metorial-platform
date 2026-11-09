import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ObjectStorageError } from 'object-storage-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createZipJobFromFile,
  objectStreamUrl,
  readObjectStream,
  writeObjectFile
} from './objectStream';

let streamOf = (chunks: Uint8Array[], onPull?: () => void) => {
  let index = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      onPull?.();

      if (index >= chunks.length) {
        controller.close();
        return;
      }

      controller.enqueue(chunks[index]!);
      index++;
    }
  });
};

describe('objectStreamUrl', () => {
  it('builds the object route', () => {
    expect(objectStreamUrl({ baseUrl: 'http://storage', bucket: 'files', key: 'str_a' })).toBe(
      'http://storage/buckets/files/objects/str_a'
    );
  });

  it('does not double up on a trailing slash', () => {
    expect(
      objectStreamUrl({ baseUrl: 'http://storage/', bucket: 'files', key: 'str_a' })
    ).toBe('http://storage/buckets/files/objects/str_a');
  });
});

describe('readObjectStream', () => {
  it('hands the body through instead of draining it', async () => {
    let pulls = 0;
    let chunks = Array.from({ length: 1000 }, (_, i) => new Uint8Array([i % 256]));
    let response = new Response(
      streamOf(chunks, () => pulls++),
      {
        headers: { 'content-length': '1000', 'content-type': 'application/zip' }
      }
    );

    let result = await readObjectStream({
      baseUrl: 'http://storage',
      bucket: 'files',
      key: 'str_a',
      fetchImpl: async () => response
    });

    // The whole point of this path: serving a file must not cost its size in
    // memory. A stream fills its one-chunk queue eagerly, but nothing beyond it
    // may be read here.
    expect(result.stream).toBe(response.body);
    expect(pulls).toBeLessThanOrEqual(1);
    expect(result.size).toBe(1000);
    expect(result.contentType).toBe('application/zip');

    let received = new Uint8Array(await new Response(result.stream).arrayBuffer());
    expect(received.byteLength).toBe(1000);
  });

  it('reports an unknown size when the backend omits content-length', async () => {
    let result = await readObjectStream({
      baseUrl: 'http://storage',
      bucket: 'files',
      key: 'str_a',
      fetchImpl: async () => {
        let response = new Response(streamOf([new Uint8Array([1])]));
        response.headers.delete('content-length');
        return response;
      }
    });

    expect(result.size).toBeUndefined();
  });

  it('surfaces a missing object as a storage error carrying the status', async () => {
    let error = await readObjectStream({
      baseUrl: 'http://storage',
      bucket: 'files',
      key: 'gone',
      fetchImpl: async () => new Response('not found', { status: 404 })
    }).catch(e => e);

    expect(error).toBeInstanceOf(ObjectStorageError);
    expect(error.statusCode).toBe(404);
  });

  it('requests the key it was given', async () => {
    let requested: string | undefined;

    await readObjectStream({
      baseUrl: 'http://storage',
      bucket: 'files',
      key: 'str_a',
      fetchImpl: async input => {
        requested = String(input);
        return new Response(streamOf([]));
      }
    });

    expect(requested).toBe('http://storage/buckets/files/objects/str_a');
  });
});

describe('writeObjectFile', () => {
  let directory: string;
  let path: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'object-stream-test-'));
    path = join(directory, 'object.bin');
    await writeFile(path, new Uint8Array([1, 2, 3, 4]));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('puts the file as a file-backed body with its content type', async () => {
    let request: { url: string; init: RequestInit } | undefined;

    await writeObjectFile({
      baseUrl: 'http://storage',
      bucket: 'files',
      key: 'skill-sync/manifests/a.ndjson',
      path,
      contentType: 'application/gzip',
      fetchImpl: async (input, init) => {
        request = { url: String(input), init: init! };
        return new Response('{}');
      }
    });

    expect(request!.url).toBe(
      'http://storage/buckets/files/objects/skill-sync/manifests/a.ndjson'
    );
    expect(request!.init.method).toBe('PUT');
    expect(request!.init.headers).toEqual({ 'content-type': 'application/gzip' });
    expect(request!.init.body).toBeInstanceOf(Blob);
    expect([...new Uint8Array(await (request!.init.body as Blob).arrayBuffer())]).toEqual([
      1, 2, 3, 4
    ]);
  });

  it('surfaces a rejected write as a storage error carrying the status', async () => {
    let error = await writeObjectFile({
      baseUrl: 'http://storage',
      bucket: 'files',
      key: 'a',
      path,
      fetchImpl: async () => new Response('too large', { status: 413 })
    }).catch(e => e);

    expect(error).toBeInstanceOf(ObjectStorageError);
    expect(error.statusCode).toBe(413);
  });
});

describe('createZipJobFromFile', () => {
  let directory: string;
  let path: string;
  let spec = '{"destination":{"bucket":"files","key":"a.zip"},"entries":[]}';

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'zip-spec-test-'));
    path = join(directory, 'spec.json');
    await writeFile(path, spec);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('puts the spec file as JSON with the wait parameter and returns the job', async () => {
    let request: { url: string; init: RequestInit } | undefined;

    let job = await createZipJobFromFile({
      baseUrl: 'http://storage/',
      jobId: 'skill-export-ske_1',
      path,
      waitSeconds: 20,
      timeoutMs: 600_000,
      fetchImpl: async (input, init) => {
        request = { url: String(input), init: init! };
        return Response.json({ id: 'skill-export-ske_1', state: 'running' });
      }
    });

    expect(job).toEqual({ id: 'skill-export-ske_1', state: 'running' });
    expect(request!.url).toBe('http://storage/zip-jobs/skill-export-ske_1?wait=20');
    expect(request!.init.method).toBe('PUT');
    expect(request!.init.headers).toEqual({ 'content-type': 'application/json' });
    expect(request!.init.signal).toBeInstanceOf(AbortSignal);
    expect(request!.init.body).toBeInstanceOf(Blob);
    expect(await (request!.init.body as Blob).text()).toBe(spec);
  });

  it('leaves out the wait parameter when none is given', async () => {
    let url: string | undefined;

    await createZipJobFromFile({
      baseUrl: 'http://storage',
      jobId: 'skill-export-ske_1',
      path,
      timeoutMs: 600_000,
      fetchImpl: async input => {
        url = String(input);
        return Response.json({});
      }
    });

    expect(url).toBe('http://storage/zip-jobs/skill-export-ske_1');
  });

  it('surfaces a refused spec as a storage error with its code and retry delay', async () => {
    let error = await createZipJobFromFile({
      baseUrl: 'http://storage',
      jobId: 'skill-export-ske_1',
      path,
      timeoutMs: 600_000,
      fetchImpl: async () =>
        Response.json(
          { code: 'spec_conflict', message: 'different spec' },
          { status: 409, headers: { 'retry-after': '3' } }
        )
    }).catch(error => error);

    expect(error).toBeInstanceOf(ObjectStorageError);
    expect(error).toMatchObject({
      statusCode: 409,
      code: 'spec_conflict',
      retryAfterSeconds: 3
    });
  });

  it('surfaces a non-JSON error body without a code', async () => {
    let error = await createZipJobFromFile({
      baseUrl: 'http://storage',
      jobId: 'skill-export-ske_1',
      path,
      timeoutMs: 600_000,
      fetchImpl: async () => new Response('bad gateway', { status: 502 })
    }).catch(error => error);

    expect(error).toMatchObject({ statusCode: 502, message: 'bad gateway', code: undefined });
  });
});

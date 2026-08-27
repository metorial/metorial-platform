import { ObjectStorageError } from 'object-storage-client';
import { describe, expect, it } from 'vitest';

import { objectStreamUrl, readObjectStream } from './objectStream';

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
    expect(objectStreamUrl({ baseUrl: 'http://storage/', bucket: 'files', key: 'str_a' })).toBe(
      'http://storage/buckets/files/objects/str_a'
    );
  });
});

describe('readObjectStream', () => {
  it('hands the body through instead of draining it', async () => {
    let pulls = 0;
    let chunks = Array.from({ length: 1000 }, (_, i) => new Uint8Array([i % 256]));
    let response = new Response(streamOf(chunks, () => pulls++), {
      headers: { 'content-length': '1000', 'content-type': 'application/zip' }
    });

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

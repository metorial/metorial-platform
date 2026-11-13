import { isServiceError } from '@lowerdeck/error';
import { gzipSync, zstdCompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodeBody, readBody, readNdjsonLines } from '../src/body';

let encoder = new TextEncoder();
let decoder = new TextDecoder();

let streamOf = (...chunks: Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (let chunk of chunks) controller.enqueue(chunk);
      controller.close();
    }
  });

let splitInto = (bytes: Uint8Array, size: number) => {
  let chunks: Uint8Array[] = [];

  for (let offset = 0; offset < bytes.length; offset += size) {
    chunks.push(bytes.subarray(offset, offset + size));
  }

  return chunks;
};

let zstd = async (bytes: Uint8Array) => new Uint8Array(zstdCompressSync(bytes));

let collect = async (lines: AsyncGenerator<string>) => {
  let result: string[] = [];
  for await (let line of lines) result.push(line);

  return result;
};

let errorCodeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    if (isServiceError(error)) return error.data.code;
    throw error;
  }

  return null;
};

describe('decodeBody', () => {
  let payload = encoder.encode('{"a":1}\n'.repeat(500));

  it('passes identity bodies through', async () => {
    let body = decodeBody(streamOf(payload), 'identity');

    expect(decoder.decode(await readBody(body))).toBe(decoder.decode(payload));
  });

  it('returns null for requests without a body', () => {
    expect(decodeBody(null, 'gzip')).toBeNull();
  });

  it('decompresses gzip bodies split across chunks', async () => {
    let compressed = new Uint8Array(gzipSync(payload));
    let body = decodeBody(streamOf(...splitInto(compressed, 7)), 'gzip');

    expect(decoder.decode(await readBody(body))).toBe(decoder.decode(payload));
  });

  it('decompresses zstd bodies', async () => {
    let compressed = await zstd(payload);
    let body = decodeBody(streamOf(...splitInto(compressed, 11)), 'zstd');

    expect(decoder.decode(await readBody(body))).toBe(decoder.decode(payload));
  });

  it('rejects identity bodies over the limit', async () => {
    let body = decodeBody(streamOf(...splitInto(new Uint8Array(100), 10)), 'identity', 99);

    expect(await errorCodeOf(readBody(body))).toBe('payload_too_large');
  });

  it('accepts bodies exactly at the limit', async () => {
    let body = decodeBody(streamOf(new Uint8Array(100)), 'identity', 100);

    expect((await readBody(body)).length).toBe(100);
  });

  it('rejects decompression bombs by decompressed size', async () => {
    let bomb = new Uint8Array(gzipSync(new Uint8Array(64 * 1024 * 1024)));

    expect(bomb.length).toBeLessThan(1024 * 1024);

    let body = decodeBody(streamOf(bomb), 'gzip', 1024 * 1024);

    expect(await errorCodeOf(readBody(body))).toBe('payload_too_large');
  });

  it('rejects zstd bombs by decompressed size', async () => {
    let bomb = await zstd(new Uint8Array(64 * 1024 * 1024));
    let body = decodeBody(streamOf(bomb), 'zstd', 1024 * 1024);

    expect(await errorCodeOf(readBody(body))).toBe('payload_too_large');
  });

  it('rejects compressed bodies whose wire size is over the limit', async () => {
    let noise = crypto.getRandomValues(new Uint8Array(65536));
    let incompressible = new Uint8Array(gzipSync(noise));
    let body = decodeBody(streamOf(...splitInto(incompressible, 1024)), 'gzip', 10_000);

    expect(await errorCodeOf(readBody(body))).toBe('payload_too_large');
  });

  it('reports corrupt gzip data as an unreadable body', async () => {
    let body = decodeBody(streamOf(encoder.encode('definitely not gzip')), 'gzip');

    expect(await errorCodeOf(readBody(body))).toBe('unreadable_body');
  });

  it('reports truncated gzip data as an unreadable body', async () => {
    let compressed = new Uint8Array(gzipSync(payload));
    let body = decodeBody(streamOf(compressed.subarray(0, 20)), 'gzip');

    expect(await errorCodeOf(readBody(body))).toBe('unreadable_body');
  });

  it('reports corrupt zstd data as an unreadable body', async () => {
    let body = decodeBody(streamOf(encoder.encode('definitely not zstd')), 'zstd');

    expect(await errorCodeOf(readBody(body))).toBe('unreadable_body');
  });
});

describe('readNdjsonLines', () => {
  let read = async (text: string, chunkSize: number, opts?: { maxLines?: number }) =>
    await collect(
      readNdjsonLines(streamOf(...splitInto(encoder.encode(text), chunkSize)), opts)
    );

  it('yields every line regardless of chunk boundaries', async () => {
    let text = '{"a":1}\n{"b":2}\n{"c":3}\n';

    for (let chunkSize of [1, 2, 3, 5, 100]) {
      expect(await read(text, chunkSize)).toEqual(['{"a":1}', '{"b":2}', '{"c":3}']);
    }
  });

  it('yields an unterminated last line', async () => {
    expect(await read('{"a":1}\n{"b":2}', 4)).toEqual(['{"a":1}', '{"b":2}']);
  });

  it('skips blank lines and handles CRLF', async () => {
    expect(await read('{"a":1}\r\n\r\n   \n{"b":2}\r\n', 3)).toEqual(['{"a":1}', '{"b":2}']);
  });

  it('keeps multi-byte characters split across chunks intact', async () => {
    let text = '{"t":"héllo 日本語 🙂"}\n{"t":"ünï"}\n';

    expect(await read(text, 1)).toEqual(['{"t":"héllo 日本語 🙂"}', '{"t":"ünï"}']);
  });

  it('yields nothing for empty or missing bodies', async () => {
    expect(await read('', 1)).toEqual([]);
    expect(await collect(readNdjsonLines(null))).toEqual([]);
  });

  it('accepts exactly maxLines lines', async () => {
    expect(await read('1\n2\n3\n', 2, { maxLines: 3 })).toEqual(['1', '2', '3']);
  });

  it('rejects bodies with more than maxLines lines', async () => {
    expect(await errorCodeOf(read('1\n2\n3\n4\n', 2, { maxLines: 3 }))).toBe('too_many_items');
  });

  it('does not count blank lines against maxLines', async () => {
    expect(await read('1\n\n2\n\n3\n\n', 2, { maxLines: 3 })).toEqual(['1', '2', '3']);
  });

  it('rejects invalid UTF-8', async () => {
    let bytes = new Uint8Array([0x7b, 0xff, 0xfe, 0x7d, 0x0a]);

    expect(await errorCodeOf(collect(readNdjsonLines(streamOf(bytes))))).toBe(
      'unreadable_body'
    );
  });

  it('allows one header line plus maxBulkItems items by default', async () => {
    let lines = Array.from({ length: 20_001 }, (_, i) => `{"i":${i}}`).join('\n');

    expect((await read(lines, 65536)).length).toBe(20_001);
    expect(await errorCodeOf(read(lines + '\n{"i":20001}', 65536))).toBe('too_many_items');
  });

  it('composes with decodeBody for gzip bulk uploads', async () => {
    let compressed = new Uint8Array(gzipSync(encoder.encode('{"h":1}\n{"i":1}\n{"i":2}\n')));
    let body = decodeBody(streamOf(...splitInto(compressed, 5)), 'gzip');

    expect(await collect(readNdjsonLines(body))).toEqual(['{"h":1}', '{"i":1}', '{"i":2}']);
  });
});

import * as zlib from 'node:zlib';
import { describe, expect, test } from 'vitest';
import {
  ContentSizeMismatchError,
  crc32Fallback,
  createContentHasher,
  hashBytes,
  hashStream
} from './content';

let pseudoRandomBytes = (size: number) => {
  let bytes = new Uint8Array(size);
  let seed = 1;
  for (let i = 0; i < size; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    bytes[i] = seed >>> 24;
  }
  return bytes;
};

let chunksOf = (bytes: Uint8Array, size: number) => {
  let chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += size) {
    chunks.push(bytes.subarray(offset, offset + size));
  }
  return chunks;
};

let toStream = (chunks: Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start: controller => {
      for (let chunk of chunks) controller.enqueue(chunk);
      controller.close();
    }
  });

// Vectors from `git hash-object`, `shasum -a 256` and Python's zlib.crc32.
let vectors = [
  {
    name: 'empty file',
    bytes: new Uint8Array(),
    gitBlobSha: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    crc32: 0
  },
  {
    name: 'hello\\n',
    bytes: new TextEncoder().encode('hello\n'),
    gitBlobSha: 'ce013625030ba8dba906f756967f9e9ca394464a',
    sha256: '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03',
    crc32: 909783072
  },
  {
    name: '3 MiB binary',
    bytes: pseudoRandomBytes(3 * 1024 * 1024),
    gitBlobSha: 'cc83d3b070a5791371b0eadd006c281a881717a6',
    sha256: 'f04c72998c9102ce67e2de8feb21a9746b704727e8b0fea7bf41d8655dee48d4',
    crc32: 2540089853
  }
];

describe('content hasher', () => {
  for (let vector of vectors) {
    test(`matches git, sha256 and crc32 for ${vector.name}`, () => {
      expect(hashBytes(vector.bytes)).toEqual({
        gitBlobSha: vector.gitBlobSha,
        sha256: vector.sha256,
        crc32: vector.crc32,
        size: vector.bytes.byteLength
      });
    });
  }

  test('keeps crc32 unsigned', () => {
    expect(hashBytes('a').crc32).toBe(0xe8b7be43);
  });

  test('accepts strings and ArrayBuffers like bytes', () => {
    let bytes = new TextEncoder().encode('hello\n');

    expect(hashBytes('hello\n')).toEqual(hashBytes(bytes));
    expect(hashBytes(bytes.slice().buffer)).toEqual(hashBytes(bytes));
  });

  test('streaming in chunks equals hashing in memory', async () => {
    let bytes = vectors[2]!.bytes;
    let expected = hashBytes(bytes);

    for (let chunkSize of [1, 7, 4096, 65_537, bytes.length]) {
      let hasher = createContentHasher({ size: bytes.length });
      for (let chunk of chunksOf(bytes, chunkSize)) hasher.update(chunk);

      expect(hasher.digest()).toEqual(expected);
    }

    expect(
      await hashStream(toStream(chunksOf(bytes, 10_000)), { size: bytes.length })
    ).toEqual(expected);
  });

  test('throws size_mismatch when the stream is shorter or longer than declared', async () => {
    let bytes = new TextEncoder().encode('hello\n');

    let short = createContentHasher({ size: 10 }).update(bytes);
    expect(() => short.digest()).toThrow(ContentSizeMismatchError);

    let error = await hashStream(toStream([bytes]), { size: 3 }).catch(e => e);
    expect(error).toBeInstanceOf(ContentSizeMismatchError);
    expect(error).toMatchObject({ code: 'size_mismatch', expectedSize: 3, actualSize: 6 });
  });

  test('rejects invalid sizes and reuse after digest', () => {
    expect(() => createContentHasher({ size: -1 })).toThrow(RangeError);
    expect(() => createContentHasher({ size: 1.5 })).toThrow(RangeError);

    let hasher = createContentHasher({ size: 0 });
    hasher.digest();
    expect(() => hasher.update('x')).toThrow();
    expect(() => hasher.digest()).toThrow();
  });

  test('table crc32 matches zlib, including incremental updates', () => {
    let bytes = pseudoRandomBytes(100_000);
    let incremental = chunksOf(bytes, 333).reduce(
      (crc, chunk) => crc32Fallback(chunk, crc),
      0
    );

    expect(crc32Fallback(bytes)).toBe(zlib.crc32(bytes));
    expect(incremental).toBe(zlib.crc32(bytes));
  });
});

import { createHash } from 'node:crypto';
import * as zlib from 'node:zlib';

export type ContentHashes = {
  sha256: string;
  gitBlobSha: string;
  crc32: number;
  size: number;
};

export type ContentHasher = {
  update: (chunk: Uint8Array | string) => ContentHasher;
  digest: () => ContentHashes;
};

export class ContentSizeMismatchError extends Error {
  readonly code = 'size_mismatch';

  constructor(
    readonly expectedSize: number,
    readonly actualSize: number
  ) {
    super(`Expected ${expectedSize} bytes of content but received ${actualSize}`);
    this.name = 'ContentSizeMismatchError';
  }
}

let crc32Table: Uint32Array | undefined;

let getCrc32Table = () => {
  if (crc32Table) return crc32Table;

  crc32Table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc32Table[n] = c >>> 0;
  }

  return crc32Table;
};

export let crc32Fallback = (data: Uint8Array, value = 0) => {
  let table = getCrc32Table();
  let crc = (value ^ 0xffffffff) >>> 0;

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

let nativeCrc32 = (zlib as { crc32?: (data: Uint8Array, value?: number) => number }).crc32;

let updateCrc32 = (data: Uint8Array, value: number) =>
  nativeCrc32 ? nativeCrc32(data, value) >>> 0 : crc32Fallback(data, value);

let toBytes = (chunk: Uint8Array | ArrayBuffer | string) =>
  typeof chunk == 'string'
    ? new TextEncoder().encode(chunk)
    : chunk instanceof Uint8Array
      ? chunk
      : new Uint8Array(chunk);

// The git blob id hashes a `blob <size>\0` header before the content, so the size has to be
// known before the first byte. A wrong size is only detectable once the stream ends.
export let createContentHasher = (d: { size: number }): ContentHasher => {
  if (!Number.isSafeInteger(d.size) || d.size < 0) {
    throw new RangeError(`Invalid content size: ${d.size}`);
  }

  let sha256 = createHash('sha256');
  let sha1 = createHash('sha1').update(`blob ${d.size}\0`);
  let crc = 0;
  let size = 0;
  let digested = false;

  let hasher: ContentHasher = {
    update: chunk => {
      if (digested) throw new Error('Content hasher was already digested');

      let bytes = toBytes(chunk);
      sha256.update(bytes);
      sha1.update(bytes);
      crc = updateCrc32(bytes, crc);
      size += bytes.byteLength;

      return hasher;
    },

    digest: () => {
      if (digested) throw new Error('Content hasher was already digested');
      digested = true;

      if (size !== d.size) throw new ContentSizeMismatchError(d.size, size);

      return {
        sha256: sha256.digest('hex'),
        gitBlobSha: sha1.digest('hex'),
        crc32: crc,
        size
      };
    }
  };

  return hasher;
};

export let hashBytes = (bytes: Uint8Array | ArrayBuffer | string) => {
  let data = toBytes(bytes);
  return createContentHasher({ size: data.byteLength }).update(data).digest();
};

export let hashStream = async (
  stream: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>,
  d: { size: number }
) => {
  let hasher = createContentHasher(d);

  for await (let chunk of stream as AsyncIterable<Uint8Array>) hasher.update(chunk);

  return hasher.digest();
};

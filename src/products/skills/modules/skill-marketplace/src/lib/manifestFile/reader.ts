import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import {
  ManifestFileError,
  manifestFormatLimits,
  ManifestPathOrder,
  parseManifestEntryLine,
  parseManifestHeaderLine,
  type ManifestEntry,
  type ManifestHeader
} from './format';

export type ManifestFileSource =
  Uint8Array | ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>;

export type ManifestFileSummary = {
  sha256: string;
  entryCount: number;
  totalBytes: number;
  byteSize: number;
};

export type OpenedManifestFile = {
  header: ManifestHeader;
  entries: AsyncGenerator<ManifestEntry, ManifestFileSummary, undefined>;
};

let newline = 0x0a;

let toAsyncIterable = (source: ManifestFileSource): AsyncIterable<Uint8Array> =>
  source instanceof Uint8Array
    ? (async function* () {
        yield source;
      })()
    : (source as AsyncIterable<Uint8Array>);

let isGzip = (chunk: Uint8Array) =>
  chunk.length >= 2 && chunk[0] === 0x1f && chunk[1] === 0x8b;

// Accepts gzip (what the writer produces) or plain NDJSON; the sha256 always covers the
// uncompressed bytes.
let decompress = async function* (source: ManifestFileSource) {
  let iterator = toAsyncIterable(source)[Symbol.asyncIterator]();

  let first = await iterator.next();
  while (!first.done && first.value.length < 2) {
    let next = await iterator.next();
    if (next.done) break;
    first = { done: false, value: Buffer.concat([first.value, next.value]) };
  }
  if (first.done) return;

  let raw = (async function* () {
    yield first.value;
    while (true) {
      let next = await iterator.next();
      if (next.done) return;
      yield next.value;
    }
  })();

  if (!isGzip(first.value)) {
    yield* raw;
    return;
  }

  let gunzip = Readable.from(raw).pipe(createGunzip());
  try {
    for await (let chunk of gunzip) yield chunk as Uint8Array;
  } catch (error) {
    if (error instanceof ManifestFileError) throw error;
    throw new ManifestFileError(`Manifest is not valid gzip: ${(error as Error).message}`);
  } finally {
    gunzip.destroy();
  }
};

let readLines = async function* (
  source: ManifestFileSource,
  hash: ReturnType<typeof createHash>
) {
  let decoder = new TextDecoder('utf-8', { fatal: true });
  let pending = Buffer.alloc(0);
  let byteSize = 0;
  let line = 0;

  for await (let chunk of decompress(source)) {
    byteSize += chunk.byteLength;
    if (byteSize > manifestFormatLimits.maxObjectBytes) {
      throw new ManifestFileError(
        `Manifest exceeds ${manifestFormatLimits.maxObjectBytes} bytes uncompressed`
      );
    }

    hash.update(chunk);
    pending = pending.length ? Buffer.concat([pending, chunk]) : Buffer.from(chunk);

    let start = 0;
    let end: number;
    while ((end = pending.indexOf(newline, start)) >= 0) {
      line++;
      if (end - start > manifestFormatLimits.maxLineBytes) {
        throw new ManifestFileError(
          `Line exceeds ${manifestFormatLimits.maxLineBytes} bytes`,
          { line }
        );
      }
      if (end === start) throw new ManifestFileError('Empty line', { line });

      let text: string;
      try {
        text = decoder.decode(pending.subarray(start, end));
      } catch {
        throw new ManifestFileError('Line is not valid UTF-8', { line });
      }

      yield { text, line };
      start = end + 1;
    }

    pending = pending.subarray(start);
    if (pending.length > manifestFormatLimits.maxLineBytes) {
      throw new ManifestFileError(`Line exceeds ${manifestFormatLimits.maxLineBytes} bytes`, {
        line: line + 1
      });
    }
  }

  if (pending.length) {
    throw new ManifestFileError('Manifest must end with a newline', { line: line + 1 });
  }

  return byteSize;
};

export let openManifestFile = async (
  source: ManifestFileSource,
  opts: { expectedSha256?: string; expectedEntryCount?: number } = {}
): Promise<OpenedManifestFile> => {
  let hash = createHash('sha256');
  let lines = readLines(source, hash);

  let first = await lines.next();
  if (first.done) throw new ManifestFileError('Manifest is empty');

  let header = parseManifestHeaderLine(first.value.text, first.value.line);
  if (opts.expectedEntryCount !== undefined && header.entryCount !== opts.expectedEntryCount) {
    throw new ManifestFileError(
      `Header declares ${header.entryCount} entries, expected ${opts.expectedEntryCount}`
    );
  }

  let entries = async function* (): AsyncGenerator<ManifestEntry, ManifestFileSummary> {
    let order = new ManifestPathOrder();
    let entryCount = 0;
    let totalBytes = 0;

    while (true) {
      let next = await lines.next();
      if (next.done) {
        if (entryCount !== header.entryCount) {
          throw new ManifestFileError(
            `Manifest has ${entryCount} entries but the header declares ${header.entryCount}`
          );
        }
        if (totalBytes !== header.totalBytes) {
          throw new ManifestFileError(
            `Entries add up to ${totalBytes} bytes but the header declares ${header.totalBytes}`
          );
        }

        let sha256 = hash.digest('hex');
        if (opts.expectedSha256 !== undefined && sha256 !== opts.expectedSha256) {
          throw new ManifestFileError(
            `Manifest sha256 ${sha256} does not match the expected ${opts.expectedSha256}`
          );
        }

        return { sha256, entryCount, totalBytes, byteSize: next.value };
      }

      let entry = parseManifestEntryLine(next.value.text, next.value.line);

      entryCount++;
      if (entryCount > header.entryCount) {
        throw new ManifestFileError(`More entries than the declared ${header.entryCount}`, {
          line: next.value.line
        });
      }
      order.add(entry.path, next.value.line);

      totalBytes += entry.size;

      yield entry;
    }
  };

  return { header, entries: entries() };
};

// Entries are only trustworthy once the stream has ended and the sha256 matched, so this
// buffers them; stream with openManifestFile when the caller can discard partial work.
export let readManifestFile = async (
  source: ManifestFileSource,
  opts: { expectedSha256?: string; expectedEntryCount?: number } = {}
) => {
  let opened = await openManifestFile(source, opts);
  let entries: ManifestEntry[] = [];

  while (true) {
    let next = await opened.entries.next();
    if (next.done) return { header: opened.header, entries, ...next.value };
    entries.push(next.value);
  }
};

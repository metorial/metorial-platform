import { createHash } from 'node:crypto';
import { createGzip } from 'node:zlib';
import {
  encodeManifestEntry,
  encodeManifestHeader,
  ManifestFileError,
  manifestFormatLimits,
  ManifestPathOrder,
  validateManifestEntry,
  validateManifestHeader,
  type ManifestEntry,
  type ManifestHeader
} from './format';
import { compareManifestPaths } from './pathRules';
import type { ManifestScope } from './scope';

export type WrittenManifestFile = {
  body: Buffer;
  sha256: string;
  entryCount: number;
  totalBytes: number;
  byteSize: number;
};

let encoder = new TextEncoder();

let sortedScope = (scope: ManifestScope): ManifestScope => ({
  dirs: [...new Set(scope.dirs)].sort(compareManifestPaths),
  files: [...new Set(scope.files)].sort(compareManifestPaths),
  globs: [...new Set(scope.globs)].sort(compareManifestPaths)
});

let encodeLines = async function* (
  header: ManifestHeader,
  entries: Iterable<ManifestEntry> | AsyncIterable<ManifestEntry>
) {
  yield encodeManifestHeader(header);

  let order = new ManifestPathOrder();
  let entryCount = 0;
  let totalBytes = 0;

  for await (let entry of entries) {
    entryCount++;
    validateManifestEntry(entry);
    order.add(entry.path);

    if (entryCount > header.entryCount) {
      throw new ManifestFileError(`More entries than the declared ${header.entryCount}`);
    }

    totalBytes += entry.size;

    yield encodeManifestEntry(entry);
  }

  if (entryCount !== header.entryCount) {
    throw new ManifestFileError(
      `Wrote ${entryCount} entries but the header declares ${header.entryCount}`
    );
  }
  if (totalBytes !== header.totalBytes) {
    throw new ManifestFileError(
      `Entries add up to ${totalBytes} bytes but the header declares ${header.totalBytes}`
    );
  }
};

let encodeManifestFile = async (
  header: ManifestHeader,
  entries: Iterable<ManifestEntry> | AsyncIterable<ManifestEntry>
): Promise<WrittenManifestFile> => {
  validateManifestHeader(header);

  let hash = createHash('sha256');
  let gzip = createGzip({ level: 9 });
  let chunks: Buffer[] = [];
  let byteSize = 0;

  gzip.on('data', chunk => chunks.push(chunk));
  let finished = new Promise<void>((resolve, reject) => {
    gzip.on('end', resolve);
    gzip.on('error', reject);
  });
  finished.catch(() => {});

  try {
    for await (let line of encodeLines(header, entries)) {
      let bytes = encoder.encode(`${line}\n`);
      if (bytes.byteLength - 1 > manifestFormatLimits.maxLineBytes) {
        throw new ManifestFileError(
          `Manifest line exceeds ${manifestFormatLimits.maxLineBytes} bytes`
        );
      }

      byteSize += bytes.byteLength;
      if (byteSize > manifestFormatLimits.maxObjectBytes) {
        throw new ManifestFileError(
          `Manifest exceeds ${manifestFormatLimits.maxObjectBytes} bytes uncompressed`
        );
      }

      hash.update(bytes);
      if (!gzip.write(bytes)) await new Promise(resolve => gzip.once('drain', resolve));
    }
  } catch (error) {
    gzip.destroy();
    throw error;
  }

  gzip.end();
  await finished;

  return {
    body: Buffer.concat(chunks),
    sha256: hash.digest('hex'),
    entryCount: header.entryCount,
    totalBytes: header.totalBytes,
    byteSize
  };
};

// Buffers and sorts the entries, so the bytes depend only on the set of entries.
export let writeManifestFile = async (d: {
  destinationId: string;
  sourceBucket: string;
  scope: ManifestScope;
  entries: Iterable<ManifestEntry>;
}) => {
  let entries = [...d.entries].sort((a, b) => compareManifestPaths(a.path, b.path));

  return await encodeManifestFile(
    {
      destinationId: d.destinationId,
      sourceBucket: d.sourceBucket,
      scope: sortedScope(d.scope),
      entryCount: entries.length,
      totalBytes: entries.reduce((sum, entry) => sum + entry.size, 0)
    },
    entries
  );
};

// For entries streamed in path byte order (e.g. `ORDER BY path COLLATE "C"`) whose count and
// total size are known up front; fails instead of writing if the stream disagrees.
export let writeSortedManifestFile = async (d: {
  destinationId: string;
  sourceBucket: string;
  scope: ManifestScope;
  entryCount: number;
  totalBytes: number;
  entries: AsyncIterable<ManifestEntry> | Iterable<ManifestEntry>;
}) =>
  await encodeManifestFile(
    {
      destinationId: d.destinationId,
      sourceBucket: d.sourceBucket,
      scope: sortedScope(d.scope),
      entryCount: d.entryCount,
      totalBytes: d.totalBytes
    },
    d.entries
  );

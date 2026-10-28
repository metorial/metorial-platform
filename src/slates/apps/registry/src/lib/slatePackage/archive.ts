import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createHash } from 'crypto';
import unzipper from 'unzipper';

export type SlatePackageEntry = {
  path: string;
  buffer: Buffer;
};

export let MAX_SLATE_PACKAGE_ENTRIES = 10_000;
export let MAX_SLATE_PACKAGE_UNPACKED_BYTES = 256 * 1024 * 1024;

let normalizeEntryPath = (path: string) =>
  path
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^package\//, '')
    .replace(/^\/+/, '');

let invalidPackage = (message: string) => new ServiceError(badRequestError({ message }));

// Zip headers can understate sizes.
let readEntryBuffer = async (entry: unzipper.File, remainingBytes: number) => {
  let chunks: Buffer[] = [];
  let size = 0;

  for await (let chunk of entry.stream()) {
    size += chunk.length;
    if (size > remainingBytes) {
      throw invalidPackage('The slate package is too large when unpacked.');
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
};

export let readZipEntries = async (
  buffer: Buffer,
  opts: {
    requireCanonicalPaths?: boolean;
  } = {}
) => {
  let directory = await unzipper.Open.buffer(buffer).catch(() => {
    throw invalidPackage('The uploaded slate package is not a valid zip archive.');
  });

  let files = directory.files.filter(entry => entry.type === 'File');
  if (files.length > MAX_SLATE_PACKAGE_ENTRIES) {
    throw invalidPackage(
      `The slate package has more than ${MAX_SLATE_PACKAGE_ENTRIES} files.`
    );
  }

  let remainingBytes = MAX_SLATE_PACKAGE_UNPACKED_BYTES;
  let entries: SlatePackageEntry[] = [];

  for (let entry of files) {
    let path = normalizeEntryPath(entry.path);
    if (!path) continue;

    if (path.split('/').includes('..')) {
      throw invalidPackage(`The slate package contains an invalid path: ${entry.path}`);
    }
    if (opts.requireCanonicalPaths && path !== entry.path) {
      throw invalidPackage(
        `Slate package paths must be relative to the package root: ${entry.path}`
      );
    }

    let content = await readEntryBuffer(entry, remainingBytes);
    remainingBytes -= content.length;
    entries.push({ path, buffer: content });
  }

  return entries;
};

// Hashes contents, not zip bytes, so re-zipped identical files match.
export let getSlatePackageChecksum = (entries: SlatePackageEntry[]) => {
  let hash = createHash('sha256');
  let sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  for (let entry of sorted) {
    hash.update(`${entry.path}\0${entry.buffer.length}\0`);
    hash.update(entry.buffer);
  }

  return `sha256:${hash.digest('hex')}`;
};

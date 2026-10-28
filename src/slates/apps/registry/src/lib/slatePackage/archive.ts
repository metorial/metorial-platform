import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createHash } from 'crypto';
import unzipper from 'unzipper';

export type SlatePackageEntry = {
  path: string;
  archivePath?: string;
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

// Declared sizes in zip headers are attacker-controlled, so count inflated bytes.
let readEntryBuffer = async (entry: unzipper.File, remainingBytes: number) => {
  let chunks: Buffer[] = [];
  let size = 0;

  try {
    for await (let chunk of entry.stream()) {
      size += chunk.length;
      if (size > remainingBytes) {
        throw invalidPackage('The slate package is too large when unpacked.');
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw invalidPackage(`The slate package entry ${entry.path} could not be read.`);
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
    entries.push({ path, archivePath: entry.path, buffer: content });
  }

  return entries;
};

// Hashes contents, not zip bytes, so re-zipped identical files match. Uses the stored
// paths, since the hub deploys those: a package/-prefixed copy is a different bundle.
export let getSlatePackageChecksum = (entries: SlatePackageEntry[]) => {
  let hash = createHash('sha256');
  let paths = entries.map(entry => ({ path: entry.archivePath ?? entry.path, entry }));
  paths.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  for (let { path, entry } of paths) {
    hash.update(`${path}\0${entry.buffer.length}\0`);
    hash.update(entry.buffer);
  }

  return `sha256:${hash.digest('hex')}`;
};

import { getFileSystemErrorCode } from '../lib/errors';
import { basename, joinPath, normalizePath } from '../lib/path';
import { isDirectoryLike } from '../lib/sort';
import type { FileEntry, FileSystemAdapter } from '../types';

export let resolveMoveTarget = async (
  adapter: FileSystemAdapter,
  source: Pick<FileEntry, 'path'>,
  input: string
) => {
  let destination = normalizePath(input);
  if (input.trim().endsWith('/')) return joinPath(destination, basename(source.path));

  try {
    let existing = await adapter.stat(destination);
    if (isDirectoryLike(existing)) return joinPath(destination, basename(source.path));
  } catch (error) {
    if (getFileSystemErrorCode(error) != 'not_found') throw error;
  }

  return destination;
};

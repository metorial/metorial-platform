import { getFileSystemErrorCode } from '../lib/errors';
import { dirname, isRootPath, normalizePath, ROOT_PATH } from '../lib/path';
import { isDirectoryLike } from '../lib/sort';
import type { FileEntry, FileSystemAdapter } from '../types';
import type { DirectorySnapshot } from './directoryStore';

export type PathKind = 'directory' | 'file';

export interface ResolvedPath {
  entry: FileEntry;
  kind: PathKind;
}

export let rootEntry = (path = ROOT_PATH): FileEntry => ({
  name: ROOT_PATH,
  path: normalizePath(path),
  type: 'directory',
  size: 0
});

export let findCachedEntry = (snapshot: DirectorySnapshot, path: string) => {
  let normalized = normalizePath(path);
  let parent = snapshot[dirname(normalized)];

  return parent?.entries.find(entry => normalizePath(entry.path) == normalized);
};

export let kindFromEntry = (entry: FileEntry): PathKind | null => {
  if (isDirectoryLike(entry)) return 'directory';
  if (entry.type == 'symlink' && !entry.targetType) return null;

  return 'file';
};

export let resolvePath = async (
  adapter: FileSystemAdapter,
  path: string,
  opts: { signal?: AbortSignal; cached?: FileEntry } = {}
): Promise<ResolvedPath> => {
  let normalized = normalizePath(path);
  if (isRootPath(normalized)) return { entry: rootEntry(), kind: 'directory' };

  let entry = opts.cached ?? (await adapter.stat(normalized, { signal: opts.signal }));
  let kind = kindFromEntry(entry);
  if (kind) return { entry, kind };

  try {
    await adapter.list(normalized, { signal: opts.signal });
    return { entry, kind: 'directory' };
  } catch (error) {
    let code = getFileSystemErrorCode(error);
    if (code == 'not_a_directory' || code == 'not_found') return { entry, kind: 'file' };

    throw error;
  }
};

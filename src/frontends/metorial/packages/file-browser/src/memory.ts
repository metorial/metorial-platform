import { FileSystemError } from './lib/errors';
import {
  basename,
  dirname,
  getAncestorPaths,
  isSameOrDescendant,
  normalizePath,
  replacePathPrefix,
  ROOT_PATH
} from './lib/path';
import type { FileEntry, FileSystemAdapter } from './types';

let PROGRESS_CHUNK_SIZE = 64 * 1024;
let DEFAULT_FILE_MODE = 0o644;
let DEFAULT_DIRECTORY_MODE = 0o755;

type MemoryNode =
  | { type: 'file'; data: Uint8Array; mode: number; modifiedAt: Date }
  | { type: 'directory'; mode: number; modifiedAt: Date }
  | { type: 'symlink'; target: string; mode: number; modifiedAt: Date };

export interface MemoryFileSystemOptions {
  files?: Record<string, string | Uint8Array>;
  directories?: string[];
  symlinks?: Record<string, string>;
  latencyMs?: number;
  listLimit?: number;
  now?: () => Date;
}

export interface MemoryFileSystem extends FileSystemAdapter {
  readText(path: string): string | null;
  paths(): string[];
}

let encoder = new TextEncoder();
let decoder = new TextDecoder();

let toBytes = (data: string | Uint8Array) =>
  typeof data == 'string' ? encoder.encode(data) : data;

let throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new FileSystemError('cancelled', 'The operation was cancelled.');
};

export let createMemoryFileSystem = (opts: MemoryFileSystemOptions = {}): MemoryFileSystem => {
  let now = opts.now ?? (() => new Date());
  let nodes = new Map<string, MemoryNode>();

  nodes.set(ROOT_PATH, { type: 'directory', mode: DEFAULT_DIRECTORY_MODE, modifiedAt: now() });

  let ensureDirectory = (path: string) => {
    for (let ancestor of getAncestorPaths(path)) {
      if (!nodes.has(ancestor)) {
        nodes.set(ancestor, {
          type: 'directory',
          mode: DEFAULT_DIRECTORY_MODE,
          modifiedAt: now()
        });
      }
    }
  };

  for (let directory of opts.directories ?? []) ensureDirectory(normalizePath(directory));

  for (let [path, data] of Object.entries(opts.files ?? {})) {
    let normalized = normalizePath(path);

    ensureDirectory(dirname(normalized));
    nodes.set(normalized, {
      type: 'file',
      data: toBytes(data),
      mode: DEFAULT_FILE_MODE,
      modifiedAt: now()
    });
  }

  for (let [path, target] of Object.entries(opts.symlinks ?? {})) {
    let normalized = normalizePath(path);

    ensureDirectory(dirname(normalized));
    nodes.set(normalized, { type: 'symlink', target, mode: 0o777, modifiedAt: now() });
  }

  let delay = async () => {
    if (opts.latencyMs) await new Promise(resolve => setTimeout(resolve, opts.latencyMs));
  };

  let resolveTarget = (path: string, target: string) =>
    normalizePath(target.startsWith('/') ? target : `${dirname(path)}/${target}`);

  let toEntry = (path: string, node: MemoryNode): FileEntry => {
    let entry: FileEntry = {
      name: path == ROOT_PATH ? ROOT_PATH : basename(path),
      path,
      type: node.type,
      size: node.type == 'file' ? node.data.byteLength : 0,
      mode: node.mode,
      modifiedAt: node.modifiedAt
    };

    if (node.type == 'symlink') {
      entry.target = node.target;
      entry.targetType = nodes.get(resolveTarget(path, node.target))?.type;
    }

    return entry;
  };

  let follow = (path: string) => {
    let node = nodes.get(path);
    if (node?.type != 'symlink') return { path, node };

    let target = resolveTarget(path, node.target);
    return { path: target, node: nodes.get(target) };
  };

  let getDirectory = (path: string) => {
    let resolved = follow(normalizePath(path));

    if (!resolved.node) throw new FileSystemError('not_found', `${path} doesn't exist.`);
    if (resolved.node.type != 'directory') {
      throw new FileSystemError('not_a_directory', `${path} isn't a directory.`);
    }

    return resolved.path;
  };

  let getFile = (path: string) => {
    let resolved = follow(normalizePath(path));

    if (!resolved.node) throw new FileSystemError('not_found', `${path} doesn't exist.`);
    if (resolved.node.type != 'file') {
      throw new FileSystemError('not_a_file', `${path} isn't a file.`);
    }

    return resolved.node;
  };

  let reportProgress = (total: number, onProgress?: (done: number, total: number) => void) => {
    if (!onProgress) return;

    for (let done = 0; done < total; done += PROGRESS_CHUNK_SIZE) onProgress(done, total);
    onProgress(total, total);
  };

  let touchParent = (path: string) => {
    let parent = nodes.get(dirname(path));
    if (parent) parent.modifiedAt = now();
  };

  return {
    list: async (path, listOpts) => {
      await delay();
      throwIfAborted(listOpts?.signal);

      let directory = getDirectory(path);
      let entries: FileEntry[] = [];
      let requested = normalizePath(path);

      for (let [childPath, node] of nodes) {
        if (childPath == ROOT_PATH || dirname(childPath) != directory) continue;
        entries.push(toEntry(normalizePath(`${requested}/${basename(childPath)}`), node));
      }

      let limit = opts.listLimit ?? Infinity;

      return { entries: entries.slice(0, limit), truncated: entries.length > limit };
    },

    stat: async (path, statOpts) => {
      await delay();
      throwIfAborted(statOpts?.signal);

      let normalized = normalizePath(path);
      let node = nodes.get(normalized);
      if (!node) throw new FileSystemError('not_found', `${path} doesn't exist.`);

      return toEntry(normalized, node);
    },

    read: async (path, readOpts = {}) => {
      await delay();
      throwIfAborted(readOpts.signal);

      let node = getFile(path);
      let offset = Math.max(0, readOpts.offset ?? 0);
      let end = readOpts.length == undefined ? undefined : offset + readOpts.length;
      let data = node.data.slice(offset, end);

      reportProgress(data.byteLength, readOpts.onProgress);
      throwIfAborted(readOpts.signal);

      return { data, size: node.data.byteLength, modifiedAt: node.modifiedAt };
    },

    write: async (path, data, writeOpts = {}) => {
      let normalized = normalizePath(path);
      let bytes = data instanceof Uint8Array ? data : new Uint8Array(await data.arrayBuffer());

      await delay();
      throwIfAborted(writeOpts.signal);

      let parent = nodes.get(dirname(normalized));
      if (!parent)
        throw new FileSystemError('not_found', `${dirname(normalized)} doesn't exist.`);
      if (parent.type != 'directory') {
        throw new FileSystemError(
          'not_a_directory',
          `${dirname(normalized)} isn't a directory.`
        );
      }

      let existing = nodes.get(normalized);
      if (existing && existing.type != 'file') {
        throw new FileSystemError('not_a_file', `${path} isn't a file.`);
      }

      if (existing && !writeOpts.overwrite) {
        throw new FileSystemError('already_exists', `${path} already exists.`);
      }

      reportProgress(bytes.byteLength, writeOpts.onProgress);
      throwIfAborted(writeOpts.signal);

      nodes.set(normalized, {
        type: 'file',
        data: bytes.slice(),
        mode: writeOpts.mode ?? existing?.mode ?? DEFAULT_FILE_MODE,
        modifiedAt: now()
      });
      touchParent(normalized);
    },

    mkdir: async path => {
      await delay();

      let normalized = normalizePath(path);
      if (nodes.has(normalized))
        throw new FileSystemError('already_exists', `${path} already exists.`);

      getDirectory(dirname(normalized));
      nodes.set(normalized, {
        type: 'directory',
        mode: DEFAULT_DIRECTORY_MODE,
        modifiedAt: now()
      });
      touchParent(normalized);
    },

    move: async (from, to) => {
      await delay();

      let source = normalizePath(from);
      let destination = normalizePath(to);

      if (source == ROOT_PATH) throw new FileSystemError('permission_denied');
      if (!nodes.has(source)) throw new FileSystemError('not_found', `${from} doesn't exist.`);
      if (nodes.has(destination)) {
        throw new FileSystemError('already_exists', `${to} already exists.`);
      }
      if (isSameOrDescendant(destination, source)) {
        throw new FileSystemError('invalid_path', `Can't move ${from} into itself.`);
      }

      getDirectory(dirname(destination));

      for (let [path, node] of Array.from(nodes)) {
        if (!isSameOrDescendant(path, source)) continue;

        nodes.delete(path);
        nodes.set(replacePathPrefix(path, source, destination), node);
      }

      touchParent(source);
      touchParent(destination);
    },

    delete: async (path, deleteOpts = {}) => {
      await delay();

      let normalized = normalizePath(path);
      let node = nodes.get(normalized);

      if (normalized == ROOT_PATH) throw new FileSystemError('permission_denied');
      if (!node) throw new FileSystemError('not_found', `${path} doesn't exist.`);

      let descendants = Array.from(nodes.keys()).filter(
        candidate => candidate != normalized && isSameOrDescendant(candidate, normalized)
      );

      if (node.type == 'directory' && descendants.length && !deleteOpts.recursive) {
        throw new FileSystemError('not_empty', `${path} isn't empty.`);
      }

      for (let descendant of descendants) nodes.delete(descendant);
      nodes.delete(normalized);
      touchParent(normalized);
    },

    readText: path => {
      let node = nodes.get(normalizePath(path));
      return node?.type == 'file' ? decoder.decode(node.data) : null;
    },

    paths: () => Array.from(nodes.keys()).sort()
  };
};

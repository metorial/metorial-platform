import { isAbortError } from '../lib/errors';
import { isSameOrDescendant, normalizePath } from '../lib/path';
import type { FileEntry, FileSystemAdapter } from '../types';

export interface DirectoryState {
  status: 'loading' | 'ready' | 'error';
  entries: FileEntry[];
  truncated: boolean;
  refreshing: boolean;
  error?: unknown;
}

export type DirectorySnapshot = Record<string, DirectoryState>;

export interface DirectoryStore {
  getSnapshot(): DirectorySnapshot;
  subscribe(listener: () => void): () => void;
  get(path: string): DirectoryState | undefined;
  load(path: string, opts?: { force?: boolean }): Promise<void>;
  forget(path: string): void;
  forgetUnder(path: string): void;
  reset(): void;
}

export let createDirectoryStore = (adapter: FileSystemAdapter): DirectoryStore => {
  let snapshot: DirectorySnapshot = {};
  let listeners = new Set<() => void>();
  let inFlight = new Map<string, { controller: AbortController; promise: Promise<void> }>();

  let emit = () => {
    for (let listener of Array.from(listeners)) listener();
  };

  let set = (path: string, state: DirectoryState | undefined) => {
    let next = { ...snapshot };

    if (state) next[path] = state;
    else delete next[path];

    snapshot = next;
    emit();
  };

  let abort = (path: string) => {
    inFlight.get(path)?.controller.abort();
    inFlight.delete(path);
  };

  let load = (rawPath: string, opts: { force?: boolean } = {}) => {
    let path = normalizePath(rawPath);
    let previous = snapshot[path];
    let pending = inFlight.get(path);

    if (!opts.force) {
      if (pending) return pending.promise;
      if (previous && previous.status != 'error') return Promise.resolve();
    }

    abort(path);

    let controller = new AbortController();
    let hasData = previous?.status == 'ready';

    set(path, {
      status: hasData ? 'ready' : 'loading',
      entries: hasData ? previous!.entries : [],
      truncated: hasData ? previous!.truncated : false,
      refreshing: hasData
    });

    let isCurrent = () => inFlight.get(path)?.controller == controller;

    let request = new Promise<Awaited<ReturnType<FileSystemAdapter['list']>>>(resolve =>
      resolve(adapter.list(path, { signal: controller.signal }))
    );

    let promise = request.then(
      result => {
        if (!isCurrent()) return;
        inFlight.delete(path);

        set(path, {
          status: 'ready',
          entries: result.entries,
          truncated: result.truncated,
          refreshing: false
        });
      },
      error => {
        if (!isCurrent()) return;
        inFlight.delete(path);

        if (isAbortError(error) && controller.signal.aborted) return;

        set(path, {
          status: 'error',
          entries: [],
          truncated: false,
          refreshing: false,
          error
        });
      }
    );

    inFlight.set(path, { controller, promise });

    return promise;
  };

  return {
    getSnapshot: () => snapshot,

    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    get: path => snapshot[normalizePath(path)],

    load,

    forget: rawPath => {
      let path = normalizePath(rawPath);

      abort(path);
      if (snapshot[path]) set(path, undefined);
    },

    forgetUnder: rawPath => {
      let path = normalizePath(rawPath);
      let affected = new Set([...Object.keys(snapshot), ...inFlight.keys()]);
      let next = { ...snapshot };

      for (let candidate of affected) {
        if (!isSameOrDescendant(candidate, path)) continue;

        abort(candidate);
        delete next[candidate];
      }

      snapshot = next;
      emit();
    },

    reset: () => {
      for (let path of Array.from(inFlight.keys())) abort(path);

      snapshot = {};
      emit();
    }
  };
};

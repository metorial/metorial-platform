import { useEffect, useRef, useState } from 'react';
import { isRootPath } from '../lib/path';
import type { FileSystemAdapter } from '../types';
import type { DirectorySnapshot } from './directoryStore';
import {
  findCachedEntry,
  kindFromEntry,
  resolvePath,
  rootEntry,
  type ResolvedPath
} from './resolvePath';

export type ResolvedPathState =
  | { status: 'loading' }
  | { status: 'ready'; result: ResolvedPath }
  | { status: 'error'; error: unknown };

type InternalState = { path: string; reloadKey: number } & ResolvedPathState;

export let useResolvedPath = (opts: {
  adapter: FileSystemAdapter;
  snapshot: DirectorySnapshot;
  path: string;
  enabled: boolean;
  reloadKey: number;
}): ResolvedPathState => {
  let { adapter, snapshot, path, enabled, reloadKey } = opts;
  let snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  let [state, setState] = useState<InternalState | null>(null);

  useEffect(() => {
    if (!enabled || isRootPath(path)) return;

    let cached = findCachedEntry(snapshotRef.current, path);
    if (cached && kindFromEntry(cached)) return;

    let controller = new AbortController();
    setState({ path, reloadKey, status: 'loading' });

    resolvePath(adapter, path, { signal: controller.signal, cached }).then(
      result => {
        if (!controller.signal.aborted) setState({ path, reloadKey, status: 'ready', result });
      },
      error => {
        if (!controller.signal.aborted) setState({ path, reloadKey, status: 'error', error });
      }
    );

    return () => controller.abort();
  }, [adapter, path, enabled, reloadKey]);

  if (isRootPath(path))
    return { status: 'ready', result: { entry: rootEntry(), kind: 'directory' } };

  let cached = findCachedEntry(snapshot, path);
  let cachedKind = cached ? kindFromEntry(cached) : null;

  if (state?.path == path && state.reloadKey == reloadKey && state.status == 'ready') {
    return {
      status: 'ready',
      result: { kind: state.result.kind, entry: cached ?? state.result.entry }
    };
  }

  if (cached && cachedKind)
    return { status: 'ready', result: { entry: cached, kind: cachedKind } };

  if (state?.path == path && state.reloadKey == reloadKey && state.status == 'error') {
    return { status: 'error', error: state.error };
  }

  return { status: 'loading' };
};

export let useElementHeight = <T extends HTMLElement>() => {
  let [element, setElement] = useState<T | null>(null);
  let [height, setHeight] = useState(0);

  useEffect(() => {
    if (!element || typeof ResizeObserver == 'undefined') return;

    let observer = new ResizeObserver(entries => {
      setHeight(Math.floor(entries[0]?.contentRect.height ?? 0));
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, height] as const;
};

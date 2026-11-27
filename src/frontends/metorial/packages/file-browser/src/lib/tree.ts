import type { DirectorySnapshot } from '../state/directoryStore';
import type { FileEntry } from '../types';
import { normalizePath } from './path';
import { DEFAULT_FILE_SORT, filterHiddenEntries, isDirectoryLike, sortEntries } from './sort';

export type TreeStatus = 'loading' | 'error' | 'empty' | 'truncated';

export type TreeRow =
  | {
      kind: 'node';
      key: string;
      path: string;
      depth: number;
      entry: FileEntry;
      expandable: boolean;
      expanded: boolean;
    }
  | {
      kind: 'status';
      key: string;
      path: string;
      depth: number;
      status: TreeStatus;
      error?: unknown;
    };

export interface FlattenTreeOptions {
  root: FileEntry;
  snapshot: DirectorySnapshot;
  expanded: ReadonlySet<string>;
  showHidden: boolean;
}

export let flattenTree = (opts: FlattenTreeOptions): TreeRow[] => {
  let rows: TreeRow[] = [];

  let visit = (entry: FileEntry, depth: number) => {
    let path = normalizePath(entry.path);
    let expandable = isDirectoryLike(entry);
    let expanded = expandable && opts.expanded.has(path);

    rows.push({ kind: 'node', key: path, path, depth, entry, expandable, expanded });
    if (!expanded) return;

    let state = opts.snapshot[path];
    let status = (status: TreeStatus, error?: unknown) =>
      rows.push({
        kind: 'status',
        key: `${path}#${status}`,
        path,
        depth: depth + 1,
        status,
        error
      });

    if (!state || (state.status == 'loading' && !state.entries.length))
      return status('loading');
    if (state.status == 'error') return status('error', state.error);

    let children = sortEntries(
      filterHiddenEntries(state.entries, opts.showHidden),
      DEFAULT_FILE_SORT
    );

    for (let child of children) visit(child, depth + 1);

    if (!children.length) status('empty');
    if (state.truncated) status('truncated');
  };

  visit(opts.root, 0);

  return rows;
};

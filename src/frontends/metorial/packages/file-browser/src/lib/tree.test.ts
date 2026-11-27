import { describe, expect, it } from 'vitest';
import type { DirectorySnapshot } from '../state/directoryStore';
import type { FileEntry } from '../types';
import { flattenTree } from './tree';

let root: FileEntry = { name: '/', path: '/', type: 'directory', size: 0 };

let dir = (path: string): FileEntry => ({
  name: path.split('/').pop()!,
  path,
  type: 'directory',
  size: 0
});

let file = (path: string): FileEntry => ({
  name: path.split('/').pop()!,
  path,
  type: 'file',
  size: 1
});

let ready = (entries: FileEntry[], truncated = false) => ({
  status: 'ready' as const,
  entries,
  truncated,
  refreshing: false
});

let describeRows = (rows: ReturnType<typeof flattenTree>) =>
  rows.map(row => `${row.depth}:${row.kind == 'node' ? row.path : row.status}`);

describe('flattenTree', () => {
  it('shows only the root while it is collapsed', () => {
    let rows = flattenTree({ root, snapshot: {}, expanded: new Set(), showHidden: false });

    expect(describeRows(rows)).toEqual(['0:/']);
  });

  it('shows a loading row for an expanded folder that has not loaded', () => {
    let rows = flattenTree({
      root,
      snapshot: {},
      expanded: new Set(['/']),
      showHidden: false
    });

    expect(describeRows(rows)).toEqual(['0:/', '1:loading']);
  });

  it('lists folders before files and nests expanded children', () => {
    let snapshot: DirectorySnapshot = {
      '/': ready([file('/readme.md'), dir('/src'), dir('/dist')]),
      '/src': ready([file('/src/b.ts'), file('/src/a.ts')])
    };

    let rows = flattenTree({
      root,
      snapshot,
      expanded: new Set(['/', '/src']),
      showHidden: false
    });

    expect(describeRows(rows)).toEqual([
      '0:/',
      '1:/dist',
      '1:/src',
      '2:/src/a.ts',
      '2:/src/b.ts',
      '1:/readme.md'
    ]);
  });

  it('marks folders as expandable and reflects expansion', () => {
    let snapshot: DirectorySnapshot = { '/': ready([dir('/src'), file('/a.txt')]) };
    let rows = flattenTree({ root, snapshot, expanded: new Set(['/']), showHidden: false });
    let nodes = rows.filter(row => row.kind == 'node');

    expect(nodes.map(n => [n.path, n.expandable, n.expanded])).toEqual([
      ['/', true, true],
      ['/src', true, false],
      ['/a.txt', false, false]
    ]);
  });

  it('hides dotfiles unless requested', () => {
    let snapshot: DirectorySnapshot = { '/': ready([file('/.env'), file('/app.ts')]) };
    let expanded = new Set(['/']);

    expect(describeRows(flattenTree({ root, snapshot, expanded, showHidden: false }))).toEqual(
      ['0:/', '1:/app.ts']
    );

    expect(describeRows(flattenTree({ root, snapshot, expanded, showHidden: true }))).toEqual([
      '0:/',
      '1:/.env',
      '1:/app.ts'
    ]);
  });

  it('reports empty, error and truncated folders', () => {
    let error = new Error('nope');

    let snapshot: DirectorySnapshot = {
      '/': ready([dir('/empty'), dir('/broken'), dir('/big')]),
      '/empty': ready([]),
      '/broken': { status: 'error', entries: [], truncated: false, refreshing: false, error },
      '/big': ready([file('/big/a')], true)
    };

    let rows = flattenTree({
      root,
      snapshot,
      expanded: new Set(['/', '/empty', '/broken', '/big']),
      showHidden: false
    });

    expect(describeRows(rows)).toEqual([
      '0:/',
      '1:/big',
      '2:/big/a',
      '2:truncated',
      '1:/broken',
      '2:error',
      '1:/empty',
      '2:empty'
    ]);

    expect(rows.find(row => row.kind == 'status' && row.status == 'error')).toMatchObject({
      error
    });
  });

  it('keeps showing stale children while a folder refreshes', () => {
    let snapshot: DirectorySnapshot = {
      '/': {
        status: 'ready',
        entries: [file('/a.txt')],
        truncated: false,
        refreshing: true
      }
    };

    let rows = flattenTree({ root, snapshot, expanded: new Set(['/']), showHidden: false });

    expect(describeRows(rows)).toEqual(['0:/', '1:/a.txt']);
  });
});

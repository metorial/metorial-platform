import { describe, expect, it, vi } from 'vitest';
import { createMemoryFileSystem } from '../memory';
import type { DirectorySnapshot } from './directoryStore';
import { findCachedEntry, kindFromEntry, resolvePath, rootEntry } from './resolvePath';

let fs = () =>
  createMemoryFileSystem({
    files: { '/app/server.ts': 'x' },
    symlinks: { '/dirlink': '/app', '/filelink': '/app/server.ts' }
  });

describe('kindFromEntry', () => {
  it('classifies directories, files and resolved links', () => {
    expect(kindFromEntry({ name: 'a', path: '/a', type: 'directory', size: 0 })).toBe(
      'directory'
    );
    expect(kindFromEntry({ name: 'a', path: '/a', type: 'file', size: 0 })).toBe('file');

    expect(
      kindFromEntry({
        name: 'l',
        path: '/l',
        type: 'symlink',
        size: 0,
        targetType: 'directory'
      })
    ).toBe('directory');

    expect(
      kindFromEntry({ name: 'l', path: '/l', type: 'symlink', size: 0, targetType: 'file' })
    ).toBe('file');
  });

  it('returns null for links whose target type is unknown', () => {
    expect(kindFromEntry({ name: 'l', path: '/l', type: 'symlink', size: 0 })).toBeNull();
  });
});

describe('resolvePath', () => {
  it('resolves the root without touching the adapter', async () => {
    let adapter = fs();
    let stat = vi.spyOn(adapter, 'stat');

    expect(await resolvePath(adapter, '/')).toEqual({ entry: rootEntry(), kind: 'directory' });
    expect(stat).not.toHaveBeenCalled();
  });

  it('resolves directories and files via stat', async () => {
    let adapter = fs();

    expect((await resolvePath(adapter, '/app')).kind).toBe('directory');
    expect((await resolvePath(adapter, '/app/server.ts')).kind).toBe('file');
  });

  it('probes symlinks to find out what they point at', async () => {
    let adapter = fs();

    expect((await resolvePath(adapter, '/dirlink')).kind).toBe('directory');
  });

  it('propagates missing paths', async () => {
    await expect(resolvePath(fs(), '/missing')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('uses a cached entry instead of calling stat', async () => {
    let adapter = fs();
    let stat = vi.spyOn(adapter, 'stat');
    let cached = await adapter.stat('/app');
    stat.mockClear();

    expect(await resolvePath(adapter, '/app', { cached })).toMatchObject({
      kind: 'directory'
    });
    expect(stat).not.toHaveBeenCalled();
  });
});

describe('findCachedEntry', () => {
  it('finds an entry in its parent listing', () => {
    let entry = { name: 'a.txt', path: '/dir/a.txt', type: 'file' as const, size: 1 };

    let snapshot: DirectorySnapshot = {
      '/dir': { status: 'ready', entries: [entry], truncated: false, refreshing: false }
    };

    expect(findCachedEntry(snapshot, '/dir/a.txt')).toBe(entry);
    expect(findCachedEntry(snapshot, '/dir/missing')).toBeUndefined();
    expect(findCachedEntry({}, '/dir/a.txt')).toBeUndefined();
  });
});

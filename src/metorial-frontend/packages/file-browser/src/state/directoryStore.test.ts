import { describe, expect, it, vi } from 'vitest';
import { FileSystemError } from '../lib/errors';
import { createMemoryFileSystem } from '../memory';
import type { FileSystemAdapter } from '../types';
import { createDirectoryStore } from './directoryStore';

let setup = () => {
  let fs = createMemoryFileSystem({
    files: { '/a/one.txt': '1', '/a/b/two.txt': '2', '/c/three.txt': '3' }
  });

  let list = vi.spyOn(fs, 'list');

  return { fs, list, store: createDirectoryStore(fs) };
};

describe('createDirectoryStore', () => {
  it('moves from loading to ready and stores entries', async () => {
    let { store } = setup();

    let pending = store.load('/a');
    expect(store.get('/a')).toMatchObject({ status: 'loading', entries: [] });

    await pending;

    expect(store.get('/a')).toMatchObject({ status: 'ready', truncated: false });
    expect(
      store
        .get('/a')
        ?.entries.map(e => e.name)
        .sort()
    ).toEqual(['b', 'one.txt']);
  });

  it('normalizes paths when reading and writing', async () => {
    let { store } = setup();

    await store.load('/a/');

    expect(store.get('/a')?.status).toBe('ready');
    expect(store.get('//a//')?.status).toBe('ready');
  });

  it('does not refetch cached directories', async () => {
    let { store, list } = setup();

    await store.load('/a');
    await store.load('/a');

    expect(list).toHaveBeenCalledTimes(1);
  });

  it('shares an in-flight request', async () => {
    let { store, list } = setup();

    await Promise.all([store.load('/a'), store.load('/a')]);

    expect(list).toHaveBeenCalledTimes(1);
  });

  it('keeps showing existing entries while a forced refresh runs', async () => {
    let { store, fs } = setup();

    await store.load('/a');
    await fs.write('/a/new.txt', new Uint8Array());

    let pending = store.load('/a', { force: true });

    expect(store.get('/a')).toMatchObject({ status: 'ready', refreshing: true });
    expect(store.get('/a')?.entries).toHaveLength(2);

    await pending;

    expect(store.get('/a')).toMatchObject({ refreshing: false });
    expect(store.get('/a')?.entries).toHaveLength(3);
  });

  it('records errors and retries them without force', async () => {
    let { store, list } = setup();

    await store.load('/missing');

    expect(store.get('/missing')?.status).toBe('error');

    await store.load('/missing');

    expect(list).toHaveBeenCalledTimes(2);
  });

  it('drops results from superseded requests', async () => {
    let resolvers: Array<(value: { entries: never[]; truncated: boolean }) => void> = [];

    let adapter = {
      list: () => new Promise(resolve => resolvers.push(resolve as never))
    } as unknown as FileSystemAdapter;

    let store = createDirectoryStore(adapter);

    let first = store.load('/a');
    let second = store.load('/a', { force: true });

    resolvers[0]!({ entries: [], truncated: true });
    resolvers[1]!({ entries: [], truncated: false });
    await Promise.all([first, second]);

    expect(store.get('/a')).toMatchObject({ status: 'ready', truncated: false });
  });

  it('ignores aborted requests instead of showing an error', async () => {
    let adapter = {
      list: (_path: string, opts?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () =>
            reject(new FileSystemError('cancelled'))
          );
        })
    } as unknown as FileSystemAdapter;

    let store = createDirectoryStore(adapter);
    let pending = store.load('/a');

    store.forget('/a');
    await pending;

    expect(store.get('/a')).toBeUndefined();
  });

  it('forgets single directories and whole subtrees', async () => {
    let { store } = setup();

    await Promise.all([store.load('/a'), store.load('/a/b'), store.load('/c')]);

    store.forget('/a/b');
    expect(store.get('/a/b')).toBeUndefined();
    expect(store.get('/a')).toBeDefined();

    await store.load('/a/b');
    store.forgetUnder('/a');

    expect(store.get('/a')).toBeUndefined();
    expect(store.get('/a/b')).toBeUndefined();
    expect(store.get('/c')).toBeDefined();
  });

  it('notifies subscribers and supports unsubscribing', async () => {
    let { store } = setup();
    let listener = vi.fn();

    let unsubscribe = store.subscribe(listener);
    await store.load('/a');

    expect(listener).toHaveBeenCalled();

    let calls = listener.mock.calls.length;
    unsubscribe();
    await store.load('/c');

    expect(listener.mock.calls.length).toBe(calls);
  });

  it('exposes a new snapshot object for every change', async () => {
    let { store } = setup();
    let before = store.getSnapshot();

    await store.load('/a');

    expect(store.getSnapshot()).not.toBe(before);
    expect(before).toEqual({});
  });

  it('resets everything', async () => {
    let { store } = setup();

    await store.load('/a');
    store.reset();

    expect(store.getSnapshot()).toEqual({});
  });
});

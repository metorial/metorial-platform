// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { compareSortedIds } from './mergedPagination';
import { mergedSource, useMergedPaginator } from './useMergedPaginator';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type Item = { id: string };

type Input = { tag: string; limit?: number; after?: string; order?: 'asc' | 'desc' };

let sortedId = (prefix: string, time: number) =>
  `${prefix}_${time.toString(36).padStart(9, '0')}abc`;

let fakeLoader = (prefix: string, times: number[]) => {
  let data = times.map(t => ({ id: sortedId(prefix, t) }));
  let listeners = new Map<string, Set<(state: any) => void>>();

  let page = (input: Input) => {
    let sorted = [...data].sort((a, b) =>
      input.order == 'asc' ? compareSortedIds(a.id, b.id) : compareSortedIds(b.id, a.id)
    );
    let from = input.after ? sorted.findIndex(i => i.id == input.after) + 1 : 0;
    let limit = input.limit ?? 10;

    return {
      items: sorted.slice(from, from + limit),
      pagination: { hasMoreAfter: from + limit < sorted.length }
    };
  };

  let loader = {
    fetchAndReturn: vi.fn(async (input: Input) => page(input)),
    subscribe: (input: Input, callback: (state: any) => void) => {
      let key = JSON.stringify(input);
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(callback);
      return () => listeners.get(key)!.delete(callback);
    }
  };

  let refresh = (next: number[]) => {
    data = next.map(t => ({ id: sortedId(prefix, t) }));
    for (let [key, callbacks] of listeners) {
      let input = JSON.parse(key);
      for (let callback of callbacks) callback({ input, output: page(input), error: null });
    }
  };

  return { loader, refresh };
};

let settle = () => act(async () => new Promise(r => setTimeout(r, 0)));

let mount = async (render: () => React.ReactElement) => {
  let host = document.createElement('div');
  let root = createRoot(host);
  await act(async () => root.render(render()));
  await settle();
  await settle();
  return {
    rerender: async (next: () => React.ReactElement) => {
      await act(async () => root.render(next()));
      await settle();
      await settle();
    },
    unmount: () => act(async () => root.unmount())
  };
};

it('loads, merges and loads more across sources', async () => {
  let a = fakeLoader('a', [1, 3, 5, 7, 9]);
  let b = fakeLoader('b', [2, 4, 6]);
  let result: any;

  let Component = () => {
    result = useMergedPaginator({
      pageSize: 3,
      order: 'asc',
      sources: {
        a: mergedSource({ loader: a.loader, input: { tag: 'a' } }),
        b: mergedSource({ loader: b.loader, input: { tag: 'b' } })
      }
    });
    return null;
  };

  let view = await mount(() => <Component />);

  expect(result.rows.map((r: any) => r.item.id)).toEqual([
    sortedId('a', 1),
    sortedId('b', 2),
    sortedId('a', 3)
  ]);
  expect(result.hasMore).toBe(true);

  await act(async () => result.loadMore());
  await settle();
  await settle();

  expect(result.rows).toHaveLength(6);

  await act(async () => result.loadMore());
  await settle();
  await settle();

  expect(result.rows).toHaveLength(8);
  expect(result.hasMore).toBe(false);
  expect(result.isLoading).toBe(false);

  await view.unmount();
});

it('keeps fetching past excluded items until the page is full', async () => {
  let a = fakeLoader('a', [1, 2, 3, 4, 5, 6, 7]);
  let excluded = new Set([1, 2, 3, 4, 5].map(t => sortedId('a', t)));
  let result: any;

  let Component = () => {
    result = useMergedPaginator({
      pageSize: 2,
      order: 'asc',
      exclude: entry => excluded.has(entry.item.id),
      sources: { a: mergedSource({ loader: a.loader, input: { tag: 'a' } }) }
    });
    return null;
  };

  let view = await mount(() => <Component />);
  for (let i = 0; i < 4; i++) await settle();

  expect(result.rows.map((r: any) => r.item.id)).toEqual([sortedId('a', 6), sortedId('a', 7)]);
  expect(result.hasMore).toBe(false);
  expect(a.loader.fetchAndReturn.mock.calls.length).toBeGreaterThan(2);

  await view.unmount();
});

it('starts over when a source input changes and skips disabled sources', async () => {
  let a = fakeLoader('a', [1, 2]);
  let b = fakeLoader('b', [3]);
  let result: any;

  let Component = ({ search, withB }: { search: string; withB: boolean }) => {
    result = useMergedPaginator({
      pageSize: 5,
      sources: {
        a: mergedSource({ loader: a.loader, input: { tag: search } }),
        b: mergedSource({ loader: b.loader, input: { tag: search }, enabled: withB })
      }
    });
    return null;
  };

  let view = await mount(() => <Component search="x" withB={false} />);
  expect(result.rows).toHaveLength(2);
  expect(b.loader.fetchAndReturn).not.toHaveBeenCalled();

  await view.rerender(() => <Component search="y" withB />);

  expect(result.rows.map((r: any) => r.item.id)).toEqual([
    sortedId('b', 3),
    sortedId('a', 2),
    sortedId('a', 1)
  ]);
  expect(a.loader.fetchAndReturn).toHaveBeenLastCalledWith(
    expect.objectContaining({ tag: 'y', limit: 5, order: 'desc' })
  );

  await view.unmount();
});

it('picks up refreshed pages from the loader', async () => {
  let a = fakeLoader('a', [1, 2]);
  let result: any;

  let Component = () => {
    result = useMergedPaginator({
      pageSize: 5,
      sources: { a: mergedSource({ loader: a.loader, input: { tag: 'a' } }) }
    });
    return null;
  };

  let view = await mount(() => <Component />);
  expect(result.rows).toHaveLength(2);

  await act(async () => a.refresh([1, 2, 3]));

  expect(result.rows.map((r: any) => r.item.id)[0]).toBe(sortedId('a', 3));

  await view.unmount();
});

it('surfaces fetch errors', async () => {
  let a = fakeLoader('a', [1]);
  a.loader.fetchAndReturn.mockRejectedValueOnce(new Error('boom'));
  let result: any;

  let Component = () => {
    result = useMergedPaginator({
      sources: { a: mergedSource({ loader: a.loader, input: { tag: 'a' } }) }
    });
    return null;
  };

  let view = await mount(() => <Component />);

  expect((result.error as Error).message).toBe('boom');
  expect(result.isLoading).toBe(false);
  expect(result.hasMore).toBe(false);

  await view.unmount();
});

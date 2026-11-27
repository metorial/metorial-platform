import type { LoaderState } from '@metorial/data-hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  mergeSources,
  type MergedEntry,
  type MergedListPage,
  type MergedRow,
  type MergedSourceInput
} from './mergedPagination';

export { compareSortedIds } from './mergedPagination';
export type { MergedEntry, MergedRow } from './mergedPagination';

type PageParams = 'limit' | 'after' | 'before' | 'cursor' | 'order';

export type MergedLoader<I, T> = {
  fetchAndReturn: (input: I) => Promise<MergedListPage<T>>;
  subscribe: (
    input: I,
    callback: (state: LoaderState<I, MergedListPage<T>>) => void
  ) => () => void;
};

export type MergedSource<I, T extends { id: string }> = {
  loader: MergedLoader<I, T>;
  input: Omit<I, PageParams>;
  enabled?: boolean;
  group?: (item: T) => string | null | undefined;
};

type ItemsOf<S> = {
  [K in keyof S]: S[K] extends MergedSource<any, infer T> ? T : never;
};

type FetchedPage = { input: any; output: MergedListPage<{ id: string }> };

export let mergedSource = <I, T extends { id: string }>(source: MergedSource<I, T>) => source;

export let useMergedPaginator = <S extends Record<string, MergedSource<any, any>>>(opts: {
  sources: S;
  pageSize?: number;
  order?: 'asc' | 'desc';
  exclude?: (entry: MergedEntry<ItemsOf<S>>) => boolean;
  resetKey?: string;
}) => {
  let pageSize = opts.pageSize ?? 25;
  let order = opts.order ?? 'desc';
  let keys = Object.keys(opts.sources);

  let identity = JSON.stringify([
    opts.resetKey ?? null,
    pageSize,
    order,
    keys.map(key => [key, opts.sources[key]!.input, opts.sources[key]!.enabled !== false])
  ]);

  let [state, setState] = useState(() => ({
    identity,
    pages: {} as Record<string, FetchedPage[]>,
    target: pageSize,
    error: null as unknown
  }));

  let current =
    state.identity == identity
      ? state
      : {
          identity,
          pages: {} as Record<string, FetchedPage[]>,
          target: pageSize,
          error: null
        };

  useEffect(() => {
    if (state.identity != identity) setState(current);
  }, [identity]);

  let sourcesRef = useRef(opts.sources);
  sourcesRef.current = opts.sources;

  let merged = mergeSources<ItemsOf<S>>({
    sources: Object.fromEntries(
      keys.map(key => [
        key,
        {
          pages: (current.pages[key] ?? []).map(page => page.output),
          enabled: opts.sources[key]!.enabled !== false,
          group: opts.sources[key]!.group
        } satisfies MergedSourceInput<{ id: string }>
      ])
    ) as { [K in keyof ItemsOf<S>]: MergedSourceInput<ItemsOf<S>[K]> },
    target: current.target,
    order,
    exclude: opts.exclude
  });

  let inFlight = useRef(new Set<string>());
  let needsKey = current.error
    ? ''
    : merged.needs.map(key => `${key}@${current.pages[key]?.length ?? 0}`).join(',');

  useEffect(() => {
    if (!needsKey) return;

    for (let need of needsKey.split(',')) {
      let flightKey = `${identity}:${need}`;
      let key = need.slice(0, need.lastIndexOf('@'));
      if (inFlight.current.has(flightKey)) continue;
      inFlight.current.add(flightKey);

      let source = sourcesRef.current[key]!;
      let fetched = current.pages[key] ?? [];
      let lastItems = fetched[fetched.length - 1]?.output.items ?? [];
      let after = lastItems[lastItems.length - 1]?.id;
      let input = { ...source.input, limit: pageSize, order, ...(after ? { after } : {}) };

      source.loader
        .fetchAndReturn(input)
        .then(
          output =>
            setState(s =>
              s.identity == identity
                ? {
                    ...s,
                    pages: { ...s.pages, [key]: [...(s.pages[key] ?? []), { input, output }] }
                  }
                : s
            ),
          error => setState(s => (s.identity == identity ? { ...s, error } : s))
        )
        .finally(() => inFlight.current.delete(flightKey));
    }
  }, [identity, needsKey]);

  let subscriptions = useRef(new Map<string, () => void>());

  useEffect(() => {
    let active = new Set<string>();

    for (let key of keys) {
      (current.pages[key] ?? []).forEach((page, index) => {
        let subKey = `${identity}:${key}:${index}`;
        active.add(subKey);
        if (subscriptions.current.has(subKey)) return;

        let unsubscribe = sourcesRef.current[key]!.loader.subscribe(
          page.input,
          loaderState => {
            let output = loaderState.output;
            if (!output) return;

            setState(s => {
              let pages = s.pages[key];
              if (s.identity != identity || !pages?.[index] || pages[index]!.output == output)
                return s;

              let next = [...pages];
              next[index] = { ...next[index]!, output };
              return { ...s, pages: { ...s.pages, [key]: next } };
            });
          }
        );

        subscriptions.current.set(subKey, unsubscribe);
      });
    }

    for (let [subKey, unsubscribe] of subscriptions.current) {
      if (active.has(subKey)) continue;
      unsubscribe();
      subscriptions.current.delete(subKey);
    }
  });

  useEffect(
    () => () => {
      for (let unsubscribe of subscriptions.current.values()) unsubscribe();
      subscriptions.current.clear();
    },
    []
  );

  let loadMore = useCallback(() => {
    setState(s => (s.identity == identity ? { ...s, target: s.target + pageSize } : s));
  }, [identity, pageSize]);

  let waiting = !current.error && merged.needs.length > 0;
  let rows: MergedRow<ItemsOf<S>>[] = merged.rows;

  return {
    rows,
    hasMore: !current.error && merged.hasMore && rows.length >= current.target,
    loadMore,
    isLoading: waiting && rows.length == 0,
    isLoadingMore: waiting && rows.length > 0 && rows.length < current.target,
    error: current.error
  };
};

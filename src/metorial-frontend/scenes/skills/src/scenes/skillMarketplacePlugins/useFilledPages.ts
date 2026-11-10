import { useEffect, useState } from 'react';

type PageResult<I> = {
  input?: { after?: string } | null;
  data: { items: I[]; pagination: { hasMoreAfter: boolean } } | null;
  error: unknown;
  refetch: () => void;
};

type LoadedPage<I> = { items: I[]; hasMoreAfter: boolean };

export let useFilledPages = <I extends { id: string }>(p: {
  resetKey: string;
  target: number;
  usePage: (after: string | undefined) => PageResult<I>;
  isAllowed: (item: I) => boolean;
}) => {
  let [activeResetKey, setActiveResetKey] = useState(p.resetKey);
  let [starts, setStarts] = useState<string[]>(['']);
  let [cursors, setCursors] = useState<string[]>(['']);
  let [pages, setPages] = useState<Record<string, LoadedPage<I>>>({});

  if (activeResetKey != p.resetKey) {
    setActiveResetKey(p.resetKey);
    setStarts(['']);
    setCursors(['']);
    setPages({});
  }

  let cursor = cursors[cursors.length - 1];
  let page = p.usePage(cursor || undefined);

  let pageMatchesCursor = (page.input?.after ?? '') == cursor;

  useEffect(() => {
    let data = page.data;
    if (!data || !pageMatchesCursor) return;

    setPages(current => ({
      ...current,
      [cursor]: { items: data.items, hasMoreAfter: data.pagination.hasMoreAfter }
    }));
  }, [page.data, cursor, pageMatchesCursor]);

  let loadedPages = cursors.flatMap(c => (pages[c] ? [pages[c]] : []));
  let seenIds = new Set<string>();
  let items = loadedPages
    .flatMap(loaded => loaded.items)
    .filter(item => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return p.isAllowed(item);
    });
  let lastPage = pages[cursor];
  let isComplete = !!lastPage && (items.length >= p.target || !lastPage.hasMoreAfter);
  let nextStart =
    isComplete && lastPage.hasMoreAfter ? lastPage.items[lastPage.items.length - 1]?.id : null;

  useEffect(() => {
    if (!lastPage || isComplete) return;

    let lastId = lastPage.items[lastPage.items.length - 1]?.id;
    if (lastId) setCursors(current => [...current, lastId]);
  }, [lastPage, isComplete]);

  return {
    items,
    isLoading: !isComplete && !page.error,
    error: page.error,
    refetch: page.refetch,
    hasNext: !!nextStart,
    hasPrevious: starts.length > 1,
    next: () => {
      if (!nextStart) return;

      setStarts(current => [...current, nextStart!]);
      setCursors([nextStart]);
    },
    previous: () => {
      if (starts.length < 2) return;

      let previousStarts = starts.slice(0, -1);
      setStarts(previousStarts);
      setCursors([previousStarts[previousStarts.length - 1]]);
    }
  };
};

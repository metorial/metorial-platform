import { useEffect, useMemo, useRef, useState } from 'react';

type PaginatedItems<TItem extends { id: string }> = {
  items: TItem[];
  pagination: {
    hasMoreAfter: boolean;
    hasMoreBefore?: boolean;
  };
};

type LoaderResult<TItem extends { id: string }> = {
  data: PaginatedItems<TItem> | null;
  isLoading: boolean;
  error: unknown;
  refetch?: () => void;
};

type LoaderParams<TParams> = (TParams & { after?: string }) | null;

let DEFAULT_POLL_INTERVAL_MS = 5_000;

export let useAccumulatedPaginatedLoader = <
  TItem extends { id: string },
  TParams extends Record<string, unknown>
>({
  enabledParams,
  queryKey,
  useLoader,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  pausePolling = false
}: {
  enabledParams: TParams | null;
  queryKey: string;
  useLoader: (params: LoaderParams<TParams>) => LoaderResult<TItem>;
  pollIntervalMs?: number;
  pausePolling?: boolean;
}) => {
  let [after, setAfter] = useState<string | undefined>(undefined);
  let [pendingAfter, setPendingAfter] = useState<string | null>(null);
  let [itemsMap, setItemsMap] = useState<Map<string, TItem>>(() => new Map());

  useEffect(() => {
    setAfter(undefined);
    setPendingAfter(null);
    setItemsMap(new Map());
  }, [queryKey]);

  let firstPage = useLoader(enabledParams);
  let cursorPage = useLoader(
    enabledParams && after !== undefined
      ? ({ ...enabledParams, after } as TParams & { after?: string })
      : null
  );

  useEffect(() => {
    let firstItems = firstPage.data?.items ?? [];
    let cursorItems = cursorPage.data?.items ?? [];
    if (!firstItems.length && !cursorItems.length) return;

    setItemsMap(current => {
      let next = new Map(current);
      for (let item of firstItems) next.set(item.id, item);
      for (let item of cursorItems) next.set(item.id, item);
      return next;
    });
  }, [firstPage.data?.items, cursorPage.data?.items]);

  useEffect(() => {
    if (!pendingAfter) return;
    if (after !== pendingAfter) return;
    if (!cursorPage.data && !cursorPage.error) return;
    setPendingAfter(null);
  }, [after, cursorPage.data, cursorPage.error, pendingAfter]);

  let refetchFirstPageRef = useRef(firstPage.refetch);
  refetchFirstPageRef.current = firstPage.refetch;

  useEffect(() => {
    if (!enabledParams || pausePolling) return;
    let id = setInterval(() => {
      refetchFirstPageRef.current?.();
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [enabledParams, pausePolling, pollIntervalMs, queryKey]);

  let items = useMemo(() => Array.from(itemsMap.values()), [itemsMap]);

  let pageForPagination = after !== undefined ? cursorPage : firstPage;
  let hasMoreAfter = pageForPagination.data?.pagination.hasMoreAfter ?? false;
  let isLoading = firstPage.isLoading && items.length === 0;
  let isLoadingMore = pendingAfter !== null;

  let loadMore = () => {
    if (pendingAfter !== null || firstPage.isLoading || cursorPage.isLoading) return;
    let currentItems = pageForPagination.data?.items ?? [];
    let lastItem = currentItems[currentItems.length - 1];
    if (!lastItem || !hasMoreAfter) return;
    setPendingAfter(lastItem.id);
    setAfter(current => (current === lastItem.id ? current : lastItem.id));
  };

  return {
    ...firstPage,
    isLoading,
    data: firstPage.data
      ? {
          ...firstPage.data,
          items,
          pagination: {
            ...firstPage.data.pagination,
            hasMoreBefore: false,
            hasMoreAfter
          }
        }
      : null,
    items,
    hasMoreAfter,
    hasMoreBefore: false,
    isLoadingMore,
    loadMore,
    reset: () => {
      setAfter(undefined);
      setPendingAfter(null);
      setItemsMap(new Map());
    }
  };
};

import {
  DashboardInstanceSessionsConnectionsListOutput,
  DashboardInstanceSessionsConnectionsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

type SessionConnectionsQuery = Omit<
  DashboardInstanceSessionsConnectionsListQuery,
  'sessionId'
>;

export let sessionConnectionsLoader = createLoader({
  name: 'sessionConnections',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      sessionId: string;
    } & SessionConnectionsQuery
  ) =>
    withAuth(sdk =>
      sdk.sessions.connections.list(i.instanceId, {
        ...i,
        sessionId: i.sessionId
      })
    ),
  mutators: {}
});

export let useSessionConnections = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: SessionConnectionsQuery
) => {
  let data = usePaginator(pagination =>
    sessionConnectionsLoader.use(
      instanceId && sessionId ? { instanceId, sessionId, ...pagination, ...query } : null
    )
  );

  return data;
};

type SessionConnectionItem = DashboardInstanceSessionsConnectionsListOutput['items'][number];

let SESSION_CONNECTIONS_POLL_INTERVAL_MS = 5_000;

export let useAccumulatedSessionConnections = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: SessionConnectionsQuery,
  options?: { pollIntervalMs?: number }
) => {
  let pollIntervalMs = options?.pollIntervalMs ?? SESSION_CONNECTIONS_POLL_INTERVAL_MS;
  let queryKey = useMemo(
    () =>
      JSON.stringify({
        instanceId: instanceId ?? null,
        sessionId: sessionId ?? null,
        query: query ?? null
      }),
    [instanceId, query, sessionId]
  );

  let [after, setAfter] = useState<string | undefined>(undefined);
  let [pendingAfter, setPendingAfter] = useState<string | null>(null);
  let [itemsMap, setItemsMap] = useState<Map<string, SessionConnectionItem>>(() => new Map());

  useEffect(() => {
    setAfter(undefined);
    setPendingAfter(null);
    setItemsMap(new Map());
  }, [queryKey]);

  let firstPage = sessionConnectionsLoader.use(
    instanceId && sessionId ? { instanceId, sessionId, ...query } : null
  );

  let cursorPage = sessionConnectionsLoader.use(
    instanceId && sessionId && after !== undefined
      ? { instanceId, sessionId, after, ...query }
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
    if (!instanceId || !sessionId) return;
    let id = setInterval(() => {
      refetchFirstPageRef.current();
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [instanceId, sessionId, queryKey, pollIntervalMs]);

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

type AllConnectionsQuery = DashboardInstanceSessionsConnectionsListQuery;

export let allSessionConnectionsLoader = createLoader({
  name: 'allSessionConnections',
  parents: [],
  fetch: (i: { instanceId: string } & AllConnectionsQuery) =>
    withAuth(sdk => sdk.sessions.connections.list(i.instanceId, i)),
  mutators: {}
});

export let useAllSessionConnections = (
  instanceId: string | null | undefined,
  query?: AllConnectionsQuery
) => {
  let data = usePaginator(pagination =>
    allSessionConnectionsLoader.use(
      instanceId ? { instanceId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let sessionConnectionLoader = createLoader({
  name: 'sessionConnection',
  parents: [],
  fetch: (i: { instanceId: string; sessionConnectionId: string }) =>
    withAuth(sdk => sdk.sessions.connections.get(i.instanceId, i.sessionConnectionId)),
  mutators: {}
});

export let useSessionConnection = (
  instanceId: string | null | undefined,
  sessionConnectionId: string | null | undefined
) => {
  let data = sessionConnectionLoader.use(
    instanceId && sessionConnectionId ? { instanceId, sessionConnectionId } : null
  );

  return data;
};

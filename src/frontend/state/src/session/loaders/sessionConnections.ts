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

export let useAccumulatedSessionConnections = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: SessionConnectionsQuery
) => {
  let queryKey = useMemo(
    () =>
      JSON.stringify({
        instanceId: instanceId ?? null,
        sessionId: sessionId ?? null,
        query: query ?? null
      }),
    [instanceId, query, sessionId]
  );
  let [after, setAfter] = useState<string | undefined>();
  let [items, setItems] = useState<SessionConnectionItem[]>([]);
  let seenPagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setAfter(undefined);
    setItems([]);
    seenPagesRef.current = new Set();
  }, [queryKey]);

  let page = sessionConnectionsLoader.use(
    instanceId && sessionId ? { instanceId, sessionId, after, ...query } : null
  );

  useEffect(() => {
    let pageItems = page.data?.items;
    if (!pageItems?.length) return;

    let pageKey = `${after ?? '__first__'}:${pageItems.map(item => item.id).join(',')}`;
    if (seenPagesRef.current.has(pageKey)) return;
    seenPagesRef.current.add(pageKey);

    setItems(current => {
      let next = [...current];
      let seenIds = new Set(current.map(item => item.id));

      for (let item of pageItems) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        next.push(item);
      }

      return next;
    });
  }, [after, page.data?.items]);

  let loadMore = () => {
    if (page.isLoading) return;

    let pageItems = page.data?.items ?? [];
    let lastItem = pageItems[pageItems.length - 1];
    if (!lastItem || !page.data?.pagination.hasMoreAfter) return;

    setAfter(current => (current === lastItem.id ? current : lastItem.id));
  };

  return {
    ...page,
    data: page.data
      ? {
          ...page.data,
          items,
          pagination: {
            ...page.data.pagination,
            hasMoreBefore: false
          }
        }
      : null,
    items,
    hasMoreAfter: page.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: false,
    isLoadingMore: page.isLoading && items.length > 0,
    loadMore,
    reset: () => {
      setAfter(undefined);
      setItems([]);
      seenPagesRef.current = new Set();
    }
  };
};

type AllConnectionsQuery = Omit<
  DashboardInstanceSessionsConnectionsListQuery,
  'sessionId'
>;

export let allSessionConnectionsLoader = createLoader({
  name: 'allSessionConnections',
  parents: [],
  fetch: (i: { instanceId: string } & AllConnectionsQuery) =>
    withAuth(sdk =>
      sdk.sessions.connections.list(i.instanceId, i)
    ),
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

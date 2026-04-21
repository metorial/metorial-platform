import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import {
  useAccumulatedSessionConnections,
  useCurrentInstance,
  useSessionErrors
} from '@metorial/state';
import { theme } from '@metorial/ui';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EditorTabItem } from '../../../../../components/editorTabs';
import {
  GroupedConnectionItems,
  PlaceholderConnectionItem,
  TracingConnectionItem
} from '../types';
import {
  CONNECT_TAB_ID,
  EXPLORER_TAB_PREFIX,
  formatConnectionLabel,
  getConnectionAccentColor,
  groupConnectionsByDay,
  isExplorerTabId,
  isMetorialExplorerConnection,
  reorderList
} from '../utils';

export let useSessionTracing = (
  session: DashboardInstanceSessionsGetOutput,
  options?: { initialExplorerTab?: boolean }
) => {
  let initialExplorerTab = options?.initialExplorerTab ?? false;
  let instance = useCurrentInstance();
  let instanceId = instance.data?.id;
  let [openTabIds, setOpenTabIds] = useState<string[]>([]);
  let [activeTabId, setActiveTabId] = useState<string | null>(null);
  let [didInitializeTabs, setDidInitializeTabs] = useState(false);
  let [explorerTabCounter, setExplorerTabCounter] = useState(0);
  let [pendingExplorerTabs, setPendingExplorerTabs] = useState<
    { tabId: string; createdAt: number }[]
  >([]);
  let [explorerConnectionByTabId, setExplorerConnectionByTabId] = useState<
    Record<string, string>
  >({});
  let listBodyRef = useRef<HTMLDivElement>(null);
  let listHeaderRef = useRef<HTMLDivElement>(null);
  let lastUserScrollIntentAtRef = useRef(0);
  let didRequestNearBottomRef = useRef(false);
  let connectionRowRefs = useRef(new Map<string, HTMLDivElement>());
  let previousConnectionIdsRef = useRef<Set<string>>(new Set());
  let previousNewestConnectionAtRef = useRef<number | null>(null);

  let [fastPollPending, setFastPollPending] = useState(false);

  useEffect(() => {
    if (pendingExplorerTabs.length === 0) {
      setFastPollPending(false);
      return;
    }

    let now = Date.now();
    let latestCreatedAt = Math.max(...pendingExplorerTabs.map(t => t.createdAt));
    let remaining = latestCreatedAt + 30_000 - now;

    if (remaining <= 0) {
      setFastPollPending(false);
      return;
    }

    setFastPollPending(true);
    let timeoutId = setTimeout(() => setFastPollPending(false), remaining);
    return () => clearTimeout(timeoutId);
  }, [pendingExplorerTabs]);

  let connections = useAccumulatedSessionConnections(
    instanceId,
    session.id,
    { limit: 50, order: 'desc' },
    { pollIntervalMs: fastPollPending ? 1_000 : undefined }
  );
  let errorScopedConnectionIds = connections.items
    .slice(0, 100)
    .map(connection => connection.id);
  let errors = useSessionErrors(errorScopedConnectionIds.length ? instanceId : null, {
    limit: 100,
    sessionConnectionId: errorScopedConnectionIds
  });

  useEffect(() => {
    setOpenTabIds([]);
    setActiveTabId(null);
    setDidInitializeTabs(false);
    setExplorerTabCounter(0);
    setPendingExplorerTabs([]);
    setExplorerConnectionByTabId({});
  }, [session.id]);

  useEffect(() => {
    let listElement = listBodyRef.current;
    if (!listElement) return;

    let noteUserScrollIntent = () => {
      lastUserScrollIntentAtRef.current = Date.now();
    };

    let onScroll = () => {
      let distanceFromBottom =
        listElement.scrollHeight - (listElement.scrollTop + listElement.clientHeight);
      let isNearBottom = distanceFromBottom <= 240;

      if (!isNearBottom) {
        didRequestNearBottomRef.current = false;
        return;
      }

      if (!connections.hasMoreAfter || connections.isLoadingMore) return;
      if (didRequestNearBottomRef.current) return;
      if (listElement.scrollHeight <= listElement.clientHeight) return;
      if (listElement.scrollTop <= 0) return;
      if (Date.now() - lastUserScrollIntentAtRef.current > 1_500) return;

      didRequestNearBottomRef.current = true;
      connections.loadMore();
    };

    listElement.addEventListener('wheel', noteUserScrollIntent, { passive: true });
    listElement.addEventListener('touchmove', noteUserScrollIntent, { passive: true });
    listElement.addEventListener('pointerdown', noteUserScrollIntent, { passive: true });
    listElement.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      listElement.removeEventListener('wheel', noteUserScrollIntent);
      listElement.removeEventListener('touchmove', noteUserScrollIntent);
      listElement.removeEventListener('pointerdown', noteUserScrollIntent);
      listElement.removeEventListener('scroll', onScroll);
    };
  }, [connections.hasMoreAfter, connections.isLoadingMore, connections.loadMore]);

  let errorConnectionIds = useMemo(() => {
    let ids = new Set<string>();
    for (let error of errors.data?.items ?? []) {
      if (error.connectionId) ids.add(error.connectionId);
    }
    return ids;
  }, [errors.data?.items]);

  let connectionItems = useMemo<TracingConnectionItem[]>(
    () =>
      connections.items.map(connection => ({
        ...connection,
        hasErrors: connection.hasErrors || errorConnectionIds.has(connection.id)
      })),
    [connections.items, errorConnectionIds]
  );

  let scrollConnectionIntoView = useCallback((connectionId: string) => {
    let listElement = listBodyRef.current;
    let rowElement = connectionRowRefs.current.get(connectionId);
    if (!listElement || !rowElement) return;

    let headerHeight = listHeaderRef.current?.offsetHeight ?? 0;
    let visibleTop = listElement.scrollTop + headerHeight;
    let visibleBottom = listElement.scrollTop + listElement.clientHeight;
    let rowTop = rowElement.offsetTop;
    let rowBottom = rowTop + rowElement.offsetHeight;

    if (rowTop >= visibleTop && rowBottom <= visibleBottom) return;

    if (rowTop < visibleTop) {
      listElement.scrollTo({
        top: Math.max(0, rowTop - headerHeight - 8),
        behavior: 'smooth'
      });
      return;
    }

    listElement.scrollTo({
      top: Math.max(0, rowBottom - listElement.clientHeight + 8),
      behavior: 'smooth'
    });
  }, []);

  let setConnectionRowElement = useCallback(
    (connectionId: string, element: HTMLDivElement | null) => {
      if (element) connectionRowRefs.current.set(connectionId, element);
      else connectionRowRefs.current.delete(connectionId);
    },
    []
  );

  useEffect(() => {
    if (didInitializeTabs) return;

    if (initialExplorerTab) {
      let tabId = `${EXPLORER_TAB_PREFIX}0__`;
      setExplorerTabCounter(1);
      setOpenTabIds([tabId]);
      setPendingExplorerTabs([{ tabId, createdAt: Date.now() }]);
      setActiveTabId(tabId);
      setDidInitializeTabs(true);
      return;
    }

    let firstConnection = connectionItems[0];
    if (!firstConnection) return;

    setOpenTabIds([firstConnection.id]);
    setActiveTabId(firstConnection.id);
    setDidInitializeTabs(true);
  }, [connectionItems, didInitializeTabs, initialExplorerTab]);

  useEffect(() => {
    let previousIds = previousConnectionIdsRef.current;
    let previousNewestAt = previousNewestConnectionAtRef.current;
    let nextIds = new Set(connectionItems.map(connection => connection.id));
    let nextNewestAt = connectionItems.length
      ? Math.max(
          ...connectionItems.map(connection => new Date(connection.createdAt).getTime())
        )
      : null;

    if (previousIds.size > 0 && previousNewestAt !== null) {
      let newlyPolledConnections = connectionItems
        .filter(connection => !previousIds.has(connection.id))
        .filter(connection => new Date(connection.createdAt).getTime() > previousNewestAt)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      let newestConnection = newlyPolledConnections[0];
      if (newestConnection) {
        requestAnimationFrame(() => scrollConnectionIntoView(newestConnection.id));
      }
    }

    previousConnectionIdsRef.current = nextIds;
    previousNewestConnectionAtRef.current = nextNewestAt;
  }, [connectionItems, scrollConnectionIntoView]);

  useEffect(() => {
    if (pendingExplorerTabs.length === 0) return;

    let assignedConnectionIds = new Set(Object.values(explorerConnectionByTabId));
    let candidateConnections = connectionItems
      .filter(isMetorialExplorerConnection)
      .filter(connection => !assignedConnectionIds.has(connection.id))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (candidateConnections.length === 0) return;

    let assignments: { tabId: string; connectionId: string }[] = [];
    let claimed = new Set<string>();
    let clockSkewBufferMs = 5_000;

    for (let pending of pendingExplorerTabs) {
      let match = candidateConnections.find(
        connection =>
          !claimed.has(connection.id) &&
          new Date(connection.createdAt).getTime() >= pending.createdAt - clockSkewBufferMs
      );

      if (match) {
        assignments.push({ tabId: pending.tabId, connectionId: match.id });
        claimed.add(match.id);
      }
    }

    if (assignments.length === 0) return;

    setExplorerConnectionByTabId(current => {
      let next = { ...current };
      for (let { tabId, connectionId } of assignments) {
        next[tabId] = connectionId;
      }
      return next;
    });

    let assignedTabIds = new Set(assignments.map(a => a.tabId));
    setPendingExplorerTabs(current => current.filter(t => !assignedTabIds.has(t.tabId)));
  }, [connectionItems, explorerConnectionByTabId, pendingExplorerTabs]);

  let connectionsById = useMemo(
    () => new Map(connectionItems.map(connection => [connection.id, connection])),
    [connectionItems]
  );

  let explorerTabIdByConnectionId = useMemo(() => {
    let map = new Map<string, string>();
    for (let [tabId, connectionId] of Object.entries(explorerConnectionByTabId)) {
      map.set(connectionId, tabId);
    }
    return map;
  }, [explorerConnectionByTabId]);

  let placeholderConnectionItems = useMemo<PlaceholderConnectionItem[]>(
    () =>
      pendingExplorerTabs.map(tab => ({
        kind: 'placeholder',
        id: `__placeholder_${tab.tabId}`,
        tabId: tab.tabId,
        label: 'Metorial Explorer',
        createdAt: new Date(tab.createdAt)
      })),
    [pendingExplorerTabs]
  );

  let groupedConnections = useMemo<GroupedConnectionItems[]>(
    () =>
      groupConnectionsByDay([
        ...connectionItems.map(connection => ({
          kind: 'connection' as const,
          ...connection
        })),
        ...placeholderConnectionItems
      ]),
    [connectionItems, placeholderConnectionItems]
  );

  let openConnection = useCallback((connectionId: string) => {
    setOpenTabIds(current =>
      current.includes(connectionId) ? current : [...current, connectionId]
    );
    setActiveTabId(connectionId);
  }, []);

  let openConnectTab = useCallback(() => {
    setOpenTabIds(current =>
      current.includes(CONNECT_TAB_ID) ? current : [...current, CONNECT_TAB_ID]
    );
    setActiveTabId(CONNECT_TAB_ID);
  }, []);

  let openExplorerTab = useCallback(() => {
    let nextId = `${EXPLORER_TAB_PREFIX}${explorerTabCounter}__`;
    setExplorerTabCounter(c => c + 1);
    setOpenTabIds(current => [...current, nextId]);
    setPendingExplorerTabs(current => [...current, { tabId: nextId, createdAt: Date.now() }]);
    setActiveTabId(nextId);
  }, [explorerTabCounter]);

  let closeTab = useCallback(
    (tabId: string) => {
      if (isExplorerTabId(tabId)) {
        setPendingExplorerTabs(current => current.filter(t => t.tabId !== tabId));
        setExplorerConnectionByTabId(current => {
          if (!(tabId in current)) return current;
          let next = { ...current };
          delete next[tabId];
          return next;
        });
      }

      setOpenTabIds(current => {
        let next = current.filter(id => id !== tabId);

        if (activeTabId === tabId) {
          setActiveTabId(next[next.length - 1] ?? null);
        }

        return next;
      });
    },
    [activeTabId]
  );

  let onReorderTabs = useCallback(
    (sourceId: string, targetId: string, position: 'before' | 'after') => {
      setOpenTabIds(current => reorderList(current, sourceId, targetId, position));
    },
    []
  );

  let explorerTabIds = useMemo(() => openTabIds.filter(isExplorerTabId), [openTabIds]);

  let explorerNumberById = useMemo(() => {
    let map = new Map<string, number>();
    let idx = 0;
    for (let id of openTabIds) {
      if (isExplorerTabId(id)) {
        idx++;
        map.set(id, idx);
      }
    }
    return map;
  }, [openTabIds]);

  let totalExplorerTabs = explorerNumberById.size;

  let openTabs = useMemo<EditorTabItem[]>(
    () =>
      openTabIds
        .map(id => {
          if (id === CONNECT_TAB_ID) {
            return {
              id: CONNECT_TAB_ID,
              label: 'Connect',
              accentColor: theme.colors.primary
            };
          }

          if (isExplorerTabId(id)) {
            let n = explorerNumberById.get(id);
            return {
              id,
              label:
                totalExplorerTabs > 1 && n ? `Metorial Explorer ${n}` : 'Metorial Explorer',
              accentColor: theme.colors.purple700
            };
          }

          let connection = connectionsById.get(id);
          if (!connection) return null;

          return {
            id: connection.id,
            label: formatConnectionLabel(connection, session),
            accentColor: getConnectionAccentColor({
              hasErrors: connection.hasErrors,
              connectionState: connection.connectionState
            }).full
          };
        })
        .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab)),
    [connectionsById, explorerNumberById, openTabIds, session, totalExplorerTabs]
  );

  let isExplorerActive = activeTabId ? isExplorerTabId(activeTabId) : false;
  let activeConnection =
    activeTabId && activeTabId !== CONNECT_TAB_ID && !isExplorerActive
      ? (connectionsById.get(activeTabId) ?? null)
      : null;

  let openAssignedExplorer = useCallback(
    (connectionId: string) => {
      let explorerTabId = explorerTabIdByConnectionId.get(connectionId);
      if (!explorerTabId) return;
      setActiveTabId(explorerTabId);
    },
    [explorerTabIdByConnectionId]
  );

  useEffect(() => {
    if (!activeTabId || activeTabId === CONNECT_TAB_ID || isExplorerTabId(activeTabId)) return;
    requestAnimationFrame(() => scrollConnectionIntoView(activeTabId));
  }, [activeTabId, scrollConnectionIntoView]);

  useLayoutEffect(() => {
    try {
      (window as any).metorial_setRestrictHeight(true);
    } catch {}

    return () => {
      try {
        (window as any).metorial_setRestrictHeight(false);
      } catch {}
    };
  }, [session.id]);

  return {
    activeConnection,
    activeTabId,
    connectionCount: connectionItems.length,
    explorerTabIdByConnectionId,
    explorerTabIds,
    groupedConnections,
    isExplorerActive,
    isLoadingConnections: connections.isLoading,
    isLoadingMoreConnections: connections.isLoadingMore,
    listBodyRef,
    listHeaderRef,
    onCloseTab: closeTab,
    onOpenAssignedExplorer: openAssignedExplorer,
    onOpenConnectTab: openConnectTab,
    onOpenConnection: openConnection,
    onOpenExplorerTab: openExplorerTab,
    onReorderTabs,
    openTabs,
    setActiveTabId,
    setConnectionRowElement
  };
};

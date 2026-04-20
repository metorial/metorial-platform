import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import {
  useAccumulatedSessionConnections,
  useCurrentInstance,
  useSessionErrors
} from '@metorial/state';
import { theme } from '@metorial/ui';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EditorTabItem } from '../../../../../components/editorTabs';
import { GroupedConnectionItems, TracingConnectionItem } from '../types';
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

export let useSessionTracing = (session: DashboardInstanceSessionsGetOutput) => {
  let instance = useCurrentInstance();
  let instanceId = instance.data?.id;
  let [openTabIds, setOpenTabIds] = useState<string[]>([]);
  let [activeTabId, setActiveTabId] = useState<string | null>(null);
  let [didInitializeTabs, setDidInitializeTabs] = useState(false);
  let [explorerTabCounter, setExplorerTabCounter] = useState(0);
  let [pendingExplorerTabIds, setPendingExplorerTabIds] = useState<string[]>([]);
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

  let connections = useAccumulatedSessionConnections(instanceId, session.id, {
    limit: 50,
    order: 'desc'
  });
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
    setPendingExplorerTabIds([]);
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

    let firstConnection = connectionItems[0];
    if (!firstConnection) return;

    setOpenTabIds([firstConnection.id]);
    setActiveTabId(firstConnection.id);
    setDidInitializeTabs(true);
  }, [connectionItems, didInitializeTabs]);

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

      if (pendingExplorerTabIds.length > 0) {
        let assignedConnectionIds = new Set(Object.values(explorerConnectionByTabId));
        let unclaimedExplorerConnections = newlyPolledConnections
          .filter(isMetorialExplorerConnection)
          .filter(connection => !assignedConnectionIds.has(connection.id))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        if (unclaimedExplorerConnections.length > 0) {
          let assignmentCount = Math.min(
            pendingExplorerTabIds.length,
            unclaimedExplorerConnections.length
          );

          setExplorerConnectionByTabId(current => {
            let next = { ...current };
            for (let i = 0; i < assignmentCount; i++) {
              next[pendingExplorerTabIds[i]] = unclaimedExplorerConnections[i].id;
            }
            return next;
          });

          setPendingExplorerTabIds(current => current.slice(assignmentCount));
        }
      }

      let newestConnection = newlyPolledConnections[0];
      if (newestConnection) {
        requestAnimationFrame(() => scrollConnectionIntoView(newestConnection.id));
      }
    }

    previousConnectionIdsRef.current = nextIds;
    previousNewestConnectionAtRef.current = nextNewestAt;
  }, [
    connectionItems,
    explorerConnectionByTabId,
    pendingExplorerTabIds,
    scrollConnectionIntoView
  ]);

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

  let groupedConnections = useMemo<GroupedConnectionItems[]>(
    () => groupConnectionsByDay(connectionItems),
    [connectionItems]
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
    setPendingExplorerTabIds(current => [...current, nextId]);
    setActiveTabId(nextId);
  }, [explorerTabCounter]);

  let closeTab = useCallback(
    (tabId: string) => {
      if (isExplorerTabId(tabId)) {
        setPendingExplorerTabIds(current => current.filter(id => id !== tabId));
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

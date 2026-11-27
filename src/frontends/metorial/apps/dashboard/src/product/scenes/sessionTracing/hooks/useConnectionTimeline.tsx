import {
  DashboardInstanceSessionsGetOutput,
  DashboardInstanceSessionsMessagesGetOutput
} from '@metorial/dashboard-sdk';
import {
  useAccumulatedProviderRuns,
  useAccumulatedSessionEvents,
  useAccumulatedSessionMessages,
  useCurrentInstance,
  useDocumentVisible,
  useProviderInvocations,
  useSessionConnection
} from '@metorial/state';
import { useEffect, useMemo, useRef } from 'react';
import { useAggregatedMessages } from '../../session/hooks/useAggregatedMessages';
import {
  getMessageMethod,
  isExplorerCapabilityMethod,
  shouldRenderStandaloneMessage
} from '../../sessionMessages';
import { SessionConnection, TimelineItemData, TimelineRowContext } from '../types';
import { formatConnectionLabel, getEventConnectionId } from '../utils';

let TIMELINE_PAGE_SIZE = 50;

export let useConnectionTimeline = ({
  session,
  connection: connectionProp
}: {
  session: DashboardInstanceSessionsGetOutput;
  connection: SessionConnection;
}) => {
  let instance = useCurrentInstance();
  let instanceId = instance.data?.id;
  let documentVisible = useDocumentVisible();
  let pausePolling = !documentVisible;

  let connectionQuery = useSessionConnection(instanceId, connectionProp.id);
  let connection = (connectionQuery.data ?? connectionProp) as SessionConnection;

  let connectionQueryParams = {
    limit: TIMELINE_PAGE_SIZE,
    order: 'desc' as const,
    sessionConnectionId: [connection.id]
  };

  let messages = useAccumulatedSessionMessages(instanceId, session.id, connectionQueryParams, {
    pausePolling
  });
  let events = useAccumulatedSessionEvents(instanceId, session.id, connectionQueryParams, {
    pausePolling
  });
  let providerRuns = useAccumulatedProviderRuns(instanceId, session.id, connectionQueryParams, {
    pausePolling
  });

  let providerRunItems = useMemo(() => providerRuns.items ?? [], [providerRuns.items]);
  let providerRunIds = useMemo(
    () => providerRunItems.map(run => run.id),
    [providerRunItems]
  );

  let providerInvocations = useProviderInvocations(
    instanceId && providerRunIds.length > 0 ? instanceId : undefined,
    providerRunIds.length > 0 ? { providerRunId: providerRunIds } : undefined
  );

  let refetchMessagesRef = useRef(messages.refetch);
  refetchMessagesRef.current = messages.refetch;
  let refetchEventsRef = useRef(events.refetch);
  refetchEventsRef.current = events.refetch;
  let refetchProviderRunsRef = useRef(providerRuns.refetch);
  refetchProviderRunsRef.current = providerRuns.refetch;
  let refetchConnectionRef = useRef(connectionQuery.refetch);
  refetchConnectionRef.current = connectionQuery.refetch;
  let refetchProviderInvocationsRef = useRef(providerInvocations.refetch);
  refetchProviderInvocationsRef.current = providerInvocations.refetch;
  let providerInvocationsLoadingRef = useRef(providerInvocations.isLoading);
  providerInvocationsLoadingRef.current = providerInvocations.isLoading;

  useEffect(() => {
    if (!instanceId || pausePolling) return;
    let id = setInterval(() => {
      refetchConnectionRef.current?.();
      refetchMessagesRef.current?.();
      refetchEventsRef.current?.();
      refetchProviderRunsRef.current?.();
      if (!providerInvocationsLoadingRef.current) {
        refetchProviderInvocationsRef.current?.();
      }
    }, 5_000);
    return () => clearInterval(id);
  }, [instanceId, pausePolling, session.id, connection.id]);

  let allMessages = useMemo(() => {
    let messageMap = new Map<string, DashboardInstanceSessionsMessagesGetOutput>();

    for (let msg of messages.items ?? []) {
      messageMap.set(msg.id, msg);
    }

    for (let evt of events.items ?? []) {
      if (evt.type === 'message_created' && evt.message) {
        let evtMsg = evt.message as DashboardInstanceSessionsMessagesGetOutput;
        let existing = messageMap.get(evtMsg.id);
        if (!existing || (!existing.output && evtMsg.output)) {
          messageMap.set(evtMsg.id, evtMsg);
        }
      }
    }

    return Array.from(messageMap.values()).sort((a, b) => {
      let aId = Number(a.transport?.mcp?.id ?? 0);
      let bId = Number(b.transport?.mcp?.id ?? 0);
      if (aId !== bId) return aId - bId;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [events.items, messages.items]);

  let messageById = useMemo(
    () => new Map(allMessages.map(message => [message.id, message])),
    [allMessages]
  );

  let aggregatedMessages = useAggregatedMessages(allMessages);
  let mcp = connection.mcp as
    | (NonNullable<SessionConnection['mcp']> & {
        client?: { name?: string; version?: string } | null;
        server?: { name?: string; version?: string } | null;
        connectionType?: string | null;
      })
    | undefined;
  let clientName = mcp?.client?.name ?? connection.participant?.name ?? 'Client';

  let visibleMessages = useMemo(
    () =>
      allMessages.filter(message =>
        shouldRenderStandaloneMessage(message, aggregatedMessages)
      ),
    [aggregatedMessages, allMessages]
  );

  let providerRunById = useMemo(
    () => new Map(providerRunItems.map(run => [run.id, run])),
    [providerRunItems]
  );

  let invocationItems = useMemo(
    () => providerInvocations.data?.items ?? [],
    [providerInvocations.data?.items]
  );
  let invocationById = useMemo(
    () => new Map(invocationItems.map(invocation => [invocation.id, invocation])),
    [invocationItems]
  );
  let hasInvocations = invocationItems.length > 0;

  let messageItemData = useMemo<TimelineItemData[]>(() => {
    let capabilityMessages = visibleMessages.filter(message =>
      isExplorerCapabilityMethod(getMessageMethod(message, aggregatedMessages))
    );
    let capabilityMessageIds = new Set(capabilityMessages.map(message => message.id));
    let items: TimelineItemData[] = [];

    if (capabilityMessages.length > 0) {
      items.push({
        kind: 'explorer_capabilities',
        id: capabilityMessages[0]?.id,
        time: capabilityMessages[0].createdAt,
        messageIds: capabilityMessages.map(message => message.id)
      });
    }

    for (let message of visibleMessages) {
      if (capabilityMessageIds.has(message.id)) continue;

      items.push({
        kind: 'message',
        id: message.id,
        time: message.createdAt,
        messageId: message.id
      });
    }

    return items;
  }, [aggregatedMessages, visibleMessages]);

  let eventItemData = useMemo<TimelineItemData[]>(() => {
    let items: TimelineItemData[] = [];
    let renderedProviderRunLogs = new Set<string>();

    for (let evt of events.items ?? []) {
      if (getEventConnectionId(evt) !== connection.id) continue;

      let type = evt.type as string;
      let runId = evt.providerRun?.id;
      let providerRun = runId ? providerRunById.get(runId) : undefined;
      let providerRunLogTime = providerRun?.createdAt ?? evt.createdAt;

      if (
        type === 'error_occurred' ||
        type === 'warning_occurred' ||
        type === 'provider_run_started' ||
        type === 'provider_run_stopped' ||
        type === 'connection_disconnected'
      ) {
        items.push({
          kind: 'event',
          id: evt.message?.id ?? evt.id,
          time: evt.createdAt,
          event: evt
        });
      }

      if (
        !hasInvocations &&
        runId &&
        !renderedProviderRunLogs.has(runId) &&
        (type === 'provider_run_started' || type === 'provider_run_stopped')
      ) {
        renderedProviderRunLogs.add(runId);
        items.push({
          kind: 'provider_run_logs',
          id: runId,
          time: providerRunLogTime,
          providerRunId: runId
        });
      }
    }

    if (!hasInvocations) {
      for (let run of providerRunItems) {
        if (!renderedProviderRunLogs.has(run.id)) {
          let evtForConn = (events.items ?? []).some(
            event =>
              getEventConnectionId(event) === connection.id &&
              event.providerRun?.id === run.id
          );
          if (evtForConn) {
            items.push({
              kind: 'provider_run_logs',
              id: run.id,
              time: run.createdAt,
              providerRunId: run.id
            });
          }
        }
      }
    }

    for (let invocation of invocationItems) {
      let relatedMessageTimes = invocation.sessionMessageIds
        .map(id => messageById.get(id)?.createdAt)
        .filter((d): d is Date => d instanceof Date);

      let time = invocation.createdAt;
      if (relatedMessageTimes.length > 0) {
        let latestMessage = relatedMessageTimes.reduce((max, d) =>
          d.getTime() > max.getTime() ? d : max
        );
        time = new Date(latestMessage.getTime() + 1);
      }

      items.push({
        kind: 'invocation',
        id: invocation.id,
        time,
        invocationId: invocation.id
      });
    }

    return items;
  }, [
    connection.id,
    events.items,
    hasInvocations,
    invocationItems,
    messageById,
    providerRunById,
    providerRunItems
  ]);

  let timelineItemData = useMemo<TimelineItemData[]>(
    () => [
      {
        kind: 'session_created',
        id: `${session.id}__session_created`,
        time: session.createdAt
      },
      {
        kind: 'connection_marker',
        id: connection.id,
        time: connection.createdAt,
        variant: 'connected'
      },
      {
        kind: 'connection_marker',
        id: `${connection.id}__created`,
        time: connection.createdAt,
        variant: 'created'
      },
      ...eventItemData,
      ...messageItemData
    ],
    [
      connection.createdAt,
      connection.id,
      eventItemData,
      messageItemData,
      session.createdAt,
      session.id
    ]
  );

  let timelineRowContext = useMemo<TimelineRowContext>(
    () => ({
      aggregatedMessages,
      clientName,
      invocationById,
      messageById,
      session
    }),
    [aggregatedMessages, clientName, invocationById, messageById, session]
  );

  let connectionProviders = useMemo(() => {
    let sessionProviderIds = new Set(
      providerRunItems.map(run => run.sessionProviderId).filter(Boolean)
    );

    if (sessionProviderIds.size === 0) return session.providers ?? [];

    return (session.providers ?? []).filter(provider => sessionProviderIds.has(provider.id));
  }, [providerRunItems, session.providers]);

  let hasMoreAfter =
    messages.hasMoreAfter || events.hasMoreAfter || providerRuns.hasMoreAfter;
  let isLoadingMore =
    messages.isLoadingMore || events.isLoadingMore || providerRuns.isLoadingMore;

  let loadMore = () => {
    if (messages.hasMoreAfter) messages.loadMore();
    if (events.hasMoreAfter) events.loadMore();
    if (providerRuns.hasMoreAfter) providerRuns.loadMore();
  };

  return {
    connection,
    connectionName: formatConnectionLabel(connection, session),
    connectionProviders,
    hasMoreAfter,
    hasTimelineActivity: timelineItemData.length > 3,
    isLoading:
      messages.isLoading ||
      events.isLoading ||
      providerRuns.isLoading ||
      (providerRunIds.length > 0 && providerInvocations.isLoading),
    isLoadingMore,
    loadMore,
    mcp,
    timelineItemData,
    timelineRowContext
  };
};

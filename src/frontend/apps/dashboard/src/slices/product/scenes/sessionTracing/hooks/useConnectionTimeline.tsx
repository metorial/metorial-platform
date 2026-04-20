import {
  DashboardInstanceSessionsGetOutput,
  DashboardInstanceSessionsMessagesGetOutput
} from '@metorial/dashboard-sdk';
import {
  useCurrentInstance,
  useProviderRuns,
  useSessionEvents,
  useSessionMessages
} from '@metorial/state';
import {
  RiCornerUpRightDoubleLine,
  RiErrorWarningLine,
  RiPlugLine,
  RiRadarLine,
  RiSendPlane2Line,
  RiServerLine
} from '@remixicon/react';
import { useMemo } from 'react';
import { Entry } from '../../session/components/entry';
import {
  ExplorerCapabilitiesMessageGroup,
  Message,
  getMessageMethod,
  isExplorerCapabilityMethod,
  shouldRenderStandaloneMessage
} from '../../session/components/message';
import { ProviderRunLogs } from '../../session/components/providerRunLogs';
import { useAggregatedMessages } from '../../session/hooks/useAggregatedMessages';
import { SessionConnection, TimelineItem } from '../types';
import { formatConnectionLabel, getEventConnectionId } from '../utils';

export let useConnectionTimeline = ({
  session,
  connection
}: {
  session: DashboardInstanceSessionsGetOutput;
  connection: SessionConnection;
}) => {
  let instance = useCurrentInstance();
  let instanceId = instance.data?.id;

  let messages = useSessionMessages(instanceId, session.id, {
    limit: 100,
    sessionConnectionId: [connection.id]
  });
  let events = useSessionEvents(instanceId, session.id, {
    limit: 100,
    sessionConnectionId: [connection.id]
  });
  let providerRuns = useProviderRuns(instanceId, session.id, {
    limit: 100,
    sessionConnectionId: [connection.id]
  });

  let allMessages = useMemo(() => {
    let messageMap = new Map<string, DashboardInstanceSessionsMessagesGetOutput>();

    for (let msg of messages.data?.items ?? []) {
      messageMap.set(msg.id, msg);
    }

    for (let evt of events.data?.items ?? []) {
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
  }, [events.data?.items, messages.data?.items]);

  let aggregatedMessages = useAggregatedMessages(allMessages);
  let mcp = connection.mcp as
    | (NonNullable<SessionConnection['mcp']> & {
        client?: { name?: string; version?: string } | null;
        server?: { name?: string; version?: string } | null;
        connectionType?: string | null;
      })
    | undefined;
  let visibleMessages = useMemo(
    () => allMessages.filter(message => shouldRenderStandaloneMessage(message, aggregatedMessages)),
    [aggregatedMessages, allMessages]
  );

  let messageItems = useMemo<TimelineItem[]>(
    () => {
      let capabilityMessages = visibleMessages.filter(message =>
        isExplorerCapabilityMethod(getMessageMethod(message, aggregatedMessages))
      );
      let capabilityMessageIds = new Set(capabilityMessages.map(message => message.id));
      let clientName = mcp?.client?.name ?? connection.participant?.name ?? 'Client';
      let items: TimelineItem[] = [];

      if (capabilityMessages.length > 0) {
        items.push({
          component: (
            <ExplorerCapabilitiesMessageGroup
              aggregatedMessages={aggregatedMessages}
              clientName={clientName}
              messages={capabilityMessages}
            />
          ),
          time: capabilityMessages[0].createdAt
        });
      }

      for (let message of visibleMessages) {
        if (capabilityMessageIds.has(message.id)) continue;

        items.push({
          component: <Message message={message} aggregatedMessages={aggregatedMessages} />,
          time: message.createdAt
        });
      }

      return items;
    },
    [aggregatedMessages, connection.participant?.name, mcp?.client?.name, visibleMessages]
  );

  let providerRunItems = providerRuns.data?.items ?? [];
  let providerRunById = useMemo(
    () => new Map(providerRunItems.map(run => [run.id, run])),
    [providerRunItems]
  );

  let eventItems = useMemo(() => {
    let items: TimelineItem[] = [];
    let renderedProviderRunLogs = new Set<string>();

    for (let evt of events.data?.items ?? []) {
      if (getEventConnectionId(evt) !== connection.id) continue;

      let type = evt.type as string;
      let runId = evt.providerRun?.id;
      let providerRun = runId ? providerRunById.get(runId) : undefined;
      let providerRunLogTime = providerRun?.createdAt ?? evt.createdAt;

      if (type === 'error_occurred') {
        let errorMsg =
          evt.error?.code && evt.error?.message
            ? `${evt.error.code} - ${evt.error.message}`
            : (evt.error?.message ?? evt.warning?.message ?? null);
        items.push({
          component: (
            <Entry
              icon={<RiErrorWarningLine />}
              title={errorMsg ? `Error: ${errorMsg}` : 'Error occurred'}
              time={evt.createdAt}
              variant="error"
            />
          ),
          time: evt.createdAt
        });
      } else if (type === 'warning_occurred') {
        let warningMsg =
          evt.warning?.code && evt.warning?.message
            ? `${evt.warning.code} - ${evt.warning.message}`
            : (evt.warning?.message ?? evt.warning?.message ?? null);
        items.push({
          component: (
            <Entry
              icon={<RiErrorWarningLine />}
              title={warningMsg ? `warning: ${warningMsg}` : 'warning occurred'}
              time={evt.createdAt}
              variant="warning"
            />
          ),
          time: evt.createdAt
        });
      } else if (type === 'provider_run_started') {
        items.push({
          component: (
            <Entry icon={<RiServerLine />} title="Provider started" time={evt.createdAt} />
          ),
          time: evt.createdAt
        });
        if (runId && !renderedProviderRunLogs.has(runId)) {
          renderedProviderRunLogs.add(runId);
          items.push({
            component: <ProviderRunLogs providerRunId={runId} lazy />,
            time: providerRunLogTime
          });
        }
      } else if (type === 'provider_run_stopped') {
        items.push({
          component: (
            <Entry icon={<RiServerLine />} title="Provider stopped" time={evt.createdAt} />
          ),
          time: evt.createdAt
        });
        if (runId && !renderedProviderRunLogs.has(runId)) {
          renderedProviderRunLogs.add(runId);
          items.push({
            component: <ProviderRunLogs providerRunId={runId} lazy />,
            time: providerRunLogTime
          });
        }
      } else if (type === 'connection_disconnected') {
        items.push({
          component: (
            <Entry
              icon={<RiPlugLine />}
              title="Connection disconnected"
              time={evt.createdAt}
            />
          ),
          time: evt.createdAt
        });
      }
    }

    for (let run of providerRunItems) {
      if (!renderedProviderRunLogs.has(run.id)) {
        let evtForConn = (events.data?.items ?? []).some(
          event =>
            getEventConnectionId(event) === connection.id && event.providerRun?.id === run.id
        );
        if (evtForConn) {
          items.push({
            component: <ProviderRunLogs providerRunId={run.id} lazy />,
            time: run.createdAt
          });
        }
      }
    }

    return items;
  }, [connection.id, events.data?.items, providerRunById, providerRunItems]);

  let timelineItems = useMemo<TimelineItem[]>(
    () => [
      {
        component: (
          <Entry icon={<RiRadarLine />} title="Client connected" time={connection.createdAt} />
        ),
        time: connection.createdAt
      },
      {
        component: (
          <Entry
            icon={<RiSendPlane2Line />}
            title="Session connection created"
            time={connection.createdAt}
          />
        ),
        time: connection.createdAt
      },
      ...eventItems,
      ...messageItems
    ],
    [connection.createdAt, eventItems, messageItems]
  );

  return {
    connectionName: formatConnectionLabel(connection, session),
    isLoading: messages.isLoading || events.isLoading || providerRuns.isLoading,
    hasTimelineActivity: timelineItems.length > 2,
    mcp,
    timelineItems,
    sessionEntry: (
      <Entry
        icon={<RiCornerUpRightDoubleLine />}
        title="Session created"
        time={session.createdAt}
      />
    )
  };
};

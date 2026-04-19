import {
  DashboardInstanceSessionsEventsListOutput,
  DashboardInstanceSessionsGetOutput,
  DashboardInstanceSessionsMessagesGetOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProviderRuns,
  useSession,
  useSessionConnections,
  useSessionEvents,
  useSessionMessages
} from '@metorial/state';
import { Callout, Entity, Spacer } from '@metorial/ui';
import {
  RiCornerUpRightDoubleLine,
  RiErrorWarningLine,
  RiPlugLine,
  RiServerLine
} from '@remixicon/react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Entry } from '../../../scenes/session/components/entry';
import { ItemList } from '../../../scenes/session/components/itemList';
import { Message } from '../../../scenes/session/components/message';
import { ProviderConnection } from '../../../scenes/session/components/providerConnection';
import { ProviderRunLogs } from '../../../scenes/session/components/providerRunLogs';
import { useAggregatedMessages } from '../../../scenes/session/hooks/useAggregatedMessages';

type SessionEvent = DashboardInstanceSessionsEventsListOutput['items'][number];

let getEventConnectionId = (evt: SessionEvent) =>
  evt.connection?.id ??
  evt.providerRun?.connectionId ??
  evt.message?.connectionId ??
  evt.error?.connectionId ??
  evt.warning?.connectionId ??
  '__ungrouped';

export let ProviderSessionLogsPage = () => {
  let instance = useCurrentInstance();
  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return renderWithLoader({ session })(({ session }) => (
    <ProviderSessionLogs session={session.data} />
  ));
};

export let ProviderSessionLogs = ({
  session
}: {
  session: DashboardInstanceSessionsGetOutput;
}) => {
  let instance = useCurrentInstance();
  let instanceId = instance.data?.id;

  let connections = useSessionConnections(instanceId, session.id, {
    limit: 100,
    order: 'asc'
  });

  let messages = useSessionMessages(instanceId, session.id, { limit: 100 });
  let events = useSessionEvents(instanceId, session.id, { limit: 100 });
  let providerRuns = useProviderRuns(instanceId, session.id, { limit: 100 });

  // Merge messages from both the messages API and event messages to ensure completeness
  let allMessages = useMemo(() => {
    let messageMap = new Map<string, DashboardInstanceSessionsMessagesGetOutput>();

    // Add messages from messages API
    for (let msg of messages.data?.items ?? []) {
      messageMap.set(msg.id, msg);
    }

    // Add/merge messages from events (events may have more complete data with output)
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
  }, [messages.data?.items, events.data?.items]);

  let aggregatedMessages = useAggregatedMessages(allMessages);

  // Find MCP client/server info from first connection
  let mcp = useMemo(() => {
    for (let conn of connections.data?.items ?? []) {
      let m = conn.mcp;
      if (!m) continue;
      return m as typeof m & {
        client?: { name?: string; version?: string } | null;
        server?: { name?: string; version?: string } | null;
        connectionType?: string | null;
      };
    }
    return undefined;
  }, [connections.data?.items]);

  let connectionItems = connections.data?.items ?? [];

  // Group messages by connectionId
  let messagesByConnection = useMemo(() => {
    let map = new Map<string, typeof allMessages>();
    for (let msg of allMessages) {
      let connId = msg.connectionId ?? '__ungrouped';
      let list = map.get(connId);
      if (!list) {
        list = [];
        map.set(connId, list);
      }
      list.push(msg);
    }
    return map;
  }, [allMessages]);

  // Group events by connection using canonical SDK fields.
  let eventsByConnection = useMemo(() => {
    let eventItems = events.data?.items ?? [];
    let map = new Map<string, typeof eventItems>();
    for (let evt of eventItems) {
      let connId = getEventConnectionId(evt);
      let list = map.get(connId);
      if (!list) {
        list = [];
        map.set(connId, list);
      }
      list.push(evt);
    }
    return map;
  }, [events.data?.items]);

  // Build message UI items for a specific connection
  let buildMessageItems = (connId: string) => {
    let connMessages = messagesByConnection.get(connId) ?? [];
    return connMessages.map(msg => ({
      component: <Message message={msg} aggregatedMessages={aggregatedMessages} />,
      time: msg.createdAt
    }));
  };

  let providerRunItems = providerRuns.data?.items ?? [];
  let providerRunById = useMemo(
    () => new Map(providerRunItems.map(run => [run.id, run])),
    [providerRunItems]
  );

  // Build event UI items for a specific connection
  let buildEventItems = (connId: string) => {
    let connEvents = eventsByConnection.get(connId) ?? [];
    let items: { component: React.ReactNode; time: Date }[] = [];
    let renderedProviderRunLogs = new Set<string>();

    for (let evt of connEvents) {
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

    // Also show logs for provider runs that only have a started event (still running)
    for (let run of providerRunItems) {
      if (!renderedProviderRunLogs.has(run.id)) {
        let evtForConn = connEvents.some(e => e.providerRun?.id === run.id);
        if (evtForConn) {
          items.push({
            component: <ProviderRunLogs providerRunId={run.id} lazy />,
            time: run.createdAt
          });
        }
      }
    }

    return items;
  };

  // Get provider name from session deployments
  let providers = session.providers ?? [];
  let providerName = providers[0]?.deployment?.name ?? undefined;

  let isLoading = connections.isLoading || messages.isLoading || events.isLoading;

  return (
    <>
      {mcp &&
        (mcp.client?.name ||
          mcp.client?.version ||
          mcp.server?.name ||
          mcp.server?.version ||
          mcp.connectionType) && (
          <Entity.Wrapper>
            <Entity.Content>
              {(mcp.client?.name || mcp.client?.version) && (
                <Entity.Field
                  title="Client"
                  value={[mcp.client?.name, mcp.client?.version].filter(Boolean).join('@')}
                />
              )}
              {(mcp.server?.name || mcp.server?.version) && (
                <Entity.Field
                  title="Server"
                  value={[mcp.server?.name, mcp.server?.version].filter(Boolean).join('@')}
                />
              )}
              {mcp.connectionType && (
                <Entity.Field
                  title="Connected Via"
                  value={
                    {
                      websocket: 'WebSocket',
                      streamable_http: 'Streamable HTTP',
                      sse: 'Server-Sent Events'
                    }[mcp.connectionType] ?? mcp.connectionType
                  }
                />
              )}
            </Entity.Content>
          </Entity.Wrapper>
        )}

      <ItemList
        items={[
          {
            component: (
              <Entry
                icon={<RiCornerUpRightDoubleLine />}
                title="Session created"
                time={session.createdAt}
              />
            ),
            time: session.createdAt
          },

          ...providers.map(dep => ({
            component: (
              <Entry
                icon={<RiCornerUpRightDoubleLine />}
                title={`Provider ${dep.deployment?.name ?? dep.providerId ?? 'Unknown'} connected`}
                time={session.createdAt}
              />
            ),
            time: session.createdAt
          })),

          ...connectionItems.map(connection => ({
            component: (
              <ProviderConnection
                connection={connection}
                providerName={providerName}
                messageItems={buildMessageItems(connection.id)}
                eventItems={buildEventItems(connection.id)}
              />
            ),
            time: connection.createdAt
          }))
        ]}
      />

      {connectionItems.length === 0 && !isLoading && (
        <>
          <Spacer height={20} />
          <Callout color="gray">
            No activity yet. Once you interact with this session via the Explorer or SDK,
            connection logs and messages will appear here.
          </Callout>
        </>
      )}
    </>
  );
};

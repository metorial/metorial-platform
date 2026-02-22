import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
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
import { useAggregatedMessages } from '../../../scenes/session/hooks/useAggregatedMessages';

export let ProviderSessionLogsPage = () => {
  let instance = useCurrentInstance();
  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return renderWithLoader({ session })(({ session }) => (
    <ProviderSessionLogs session={session.data} />
  ));
};

let ProviderSessionLogs = ({ session }: { session: DashboardInstanceSessionsGetOutput }) => {
  let instance = useCurrentInstance();
  let instanceId = instance.data?.id;

  let connections = useSessionConnections(instanceId, session.id, {
    limit: 100,
    order: 'asc'
  });

  let messages = useSessionMessages(instanceId, session.id, { limit: 100 });
  let events = useSessionEvents(instanceId, session.id, { limit: 100 });

  let aggregatedMessages = useAggregatedMessages(messages.data?.items);

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

  // Group messages by connectionId (mapped to serverSessionId)
  let messagesByConnection = useMemo(() => {
    let items = messages.data?.items ?? [];
    let map = new Map<string, typeof items>();
    for (let msg of messages.data?.items ?? []) {
      let connId = msg.connectionId ?? '__ungrouped';
      let list = map.get(connId);
      if (!list) {
        list = [];
        map.set(connId, list);
      }
      list.push(msg);
    }
    return map;
  }, [messages.data?.items]);

  // Group events by connection (using raw connectionId from event data)
  let eventsByConnection = useMemo(() => {
    let eventItems = events.data?.items ?? [];
    let map = new Map<string, typeof eventItems>();
    for (let evt of eventItems) {
      let raw = evt as Record<string, unknown>;
      // Events have connection info in the raw data
      let connId =
        (raw.connectionId as string) ??
        ((raw.connection as Record<string, unknown>)?.id as string) ??
        '__ungrouped';
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
      component: (
        <Message
          message={msg}
          aggregatedMessages={aggregatedMessages}
        />
      ),
      time: msg.createdAt
    }));
  };

  // Build event UI items for a specific connection
  let buildEventItems = (connId: string) => {
    let connEvents = eventsByConnection.get(connId) ?? [];
    let items: { component: React.ReactNode; time: Date }[] = [];
    for (let evt of connEvents) {
      let type = evt.type as string;

      if (type === 'provider_run_started') {
        items.push({
          component: (
            <Entry icon={<RiServerLine />} title="Provider started" time={evt.createdAt} />
          ),
          time: evt.createdAt
        });
      } else if (type === 'provider_run_stopped') {
        items.push({
          component: (
            <Entry icon={<RiServerLine />} title="Provider stopped" time={evt.createdAt} />
          ),
          time: evt.createdAt
        });
      } else if (type === 'error_occurred') {
        items.push({
          component: (
            <Entry
              icon={<RiErrorWarningLine />}
              title="Error occurred"
              time={evt.createdAt}
              variant="error"
            />
          ),
          time: evt.createdAt
        });
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
    return items;
  };

  // Get provider name from session deployments
  let providers = session.providers ?? [];
  let providerName = providers[0]?.deployment?.name ?? undefined;

  let isLoading = connections.isLoading || messages.isLoading || events.isLoading;

  return (
    <>
      {mcp && (
        <>
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
          <Spacer height={20} />
        </>
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
                connection={{
                  ...connection,
                  startedAt: connection.createdAt
                }}
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

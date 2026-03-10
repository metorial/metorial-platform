import {
  DashboardInstanceSessionsConnectionsGetOutput,
  DashboardInstanceSessionsMessagesGetOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useSessionConnection,
  useSessionEvents,
  useSessionMessages
} from '@metorial/state';
import { Callout, Entity, Spacer } from '@metorial/ui';
import { RiCornerUpRightDoubleLine, RiErrorWarningLine, RiPlugLine } from '@remixicon/react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Entry } from '../../../scenes/session/components/entry';
import { ItemList } from '../../../scenes/session/components/itemList';
import { Message } from '../../../scenes/session/components/message';
import { useAggregatedMessages } from '../../../scenes/session/hooks/useAggregatedMessages';

export let MagicMcpConnectionMessagesPage = () => {
  let instance = useCurrentInstance();
  let { connectionId } = useParams();
  let connection = useSessionConnection(instance.data?.id, connectionId);

  return renderWithLoader({ connection })(({ connection }) => (
    <ConnectionMessages connection={connection.data} />
  ));
};

let ConnectionMessages = ({
  connection
}: {
  connection: DashboardInstanceSessionsConnectionsGetOutput;
}) => {
  let instance = useCurrentInstance();
  let instanceId = instance.data?.id;

  let messages = useSessionMessages(instanceId, connection.sessionId, {
    sessionConnectionId: connection.id,
    limit: 100
  });

  let events = useSessionEvents(instanceId, connection.sessionId, {
    sessionConnectionId: connection.id,
    limit: 100
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
  }, [messages.data?.items, events.data?.items]);

  let aggregatedMessages = useAggregatedMessages(allMessages);

  let mcp = connection.mcp as
    | (typeof connection.mcp & {
        client?: { name?: string; version?: string } | null;
        server?: { name?: string; version?: string } | null;
        connectionType?: string | null;
      })
    | null;

  let messageItems = allMessages.map(msg => ({
    component: <Message message={msg} aggregatedMessages={aggregatedMessages} />,
    time: msg.createdAt
  }));

  let eventItems = (events.data?.items ?? [])
    .map(evt => {
      if (evt.type === 'error_occurred') {
        let errorMsg =
          evt.error?.code && evt.error?.message
            ? `${evt.error.code} - ${evt.error.message}`
            : (evt.error?.message ?? 'Unknown error');
        return {
          component: (
            <Entry
              icon={<RiErrorWarningLine />}
              title={`Error: ${errorMsg}`}
              time={evt.createdAt}
              variant="error"
            />
          ),
          time: evt.createdAt
        };
      }

      if (evt.type === 'connection_disconnected') {
        return {
          component: (
            <Entry
              icon={<RiPlugLine />}
              title="Connection disconnected"
              time={evt.createdAt}
            />
          ),
          time: evt.createdAt
        };
      }

      return null;
    })
    .filter(Boolean);

  let isLoading = messages.isLoading || events.isLoading;

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
                title="Client connected"
                time={connection.createdAt}
              />
            ),
            time: connection.createdAt
          },
          ...eventItems,
          ...messageItems
        ]}
      />

      {allMessages.length === 0 && !isLoading && (
        <>
          <Spacer height={20} />
          <Callout color="gray">
            No messages yet. Once MCP messages are exchanged on this connection, they will appear
            here.
          </Callout>
        </>
      )}
    </>
  );
};

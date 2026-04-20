import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import { Callout, CenteredSpinner, Entity, RenderDate } from '@metorial/ui';
import styled from 'styled-components';
import { SessionConnectionStatusBadge } from '../../providerSessions/table';
import { ItemList } from '../../session/components/itemList';
import { useConnectionTimeline } from '../hooks/useConnectionTimeline';
import { SessionConnection } from '../types';

let DetailContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
`;

let DetailTimeline = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

let LoadingWrap = styled.div`
  display: flex;
  justify-content: center;
  padding: 20px;
`;

export let ConnectionLogs = ({
  session,
  connection
}: {
  session: DashboardInstanceSessionsGetOutput;
  connection: SessionConnection;
}) => {
  let { connectionName, hasTimelineActivity, isLoading, mcp, sessionEntry, timelineItems } =
    useConnectionTimeline({
      session,
      connection
    });

  return (
    <DetailContent>
      <Entity.Wrapper>
        <Entity.Content>
          <Entity.Field title="Connection" value={connectionName} />
          <Entity.Field
            title="Status"
            value={
              <SessionConnectionStatusBadge
                connectionStatus={connection.connectionState}
                hasErrors={connection.hasErrors}
                hasWarnings={connection.hasWarnings}
              />
            }
          />
          <Entity.Field title="Connection ID" value={connection.id} />
          <Entity.Field
            title="Created At"
            value={<RenderDate date={connection.createdAt} />}
          />
          {connection.lastActiveAt && (
            <Entity.Field
              title="Last Active"
              value={<RenderDate date={connection.lastActiveAt} />}
            />
          )}
        </Entity.Content>
      </Entity.Wrapper>

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

      <DetailTimeline>
        {sessionEntry}

        <ItemList items={timelineItems} />

        {!hasTimelineActivity && !isLoading && (
          <Callout color="gray">
            No activity has been recorded for this connection yet.
          </Callout>
        )}

        {isLoading && (
          <LoadingWrap>
            <CenteredSpinner size={16} />
          </LoadingWrap>
        )}
      </DetailTimeline>
    </DetailContent>
  );
};

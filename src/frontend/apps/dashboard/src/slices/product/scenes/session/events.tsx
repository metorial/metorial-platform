import { renderWithLoader } from '@metorial/data-hooks';
import { SessionsGetOutput } from '@metorial/generated';
import { useCurrentInstance, useSessionServerSessions } from '@metorial/state';
import { Callout, Entity, Spacer } from '@metorial/ui';
import { RiCornerUpRightDoubleLine } from '@remixicon/react';
import { useMemo } from 'react';
import { Entry } from './components/entry';
import { ItemList } from './components/itemList';
import { ServerSession } from './components/serverSession';

export let SessionEvents = ({ session }: { session: SessionsGetOutput | null }) => {
  let instance = useCurrentInstance();

  let serverSessions = useSessionServerSessions(instance.data?.id, session?.id, {
    limit: 100,
    order: 'asc'
  });

  let mcp = useMemo(
    () => (serverSessions.data?.items ?? []).map(s => s.mcp).find(Boolean) ?? undefined,
    [serverSessions.data?.items]
  );

  return renderWithLoader({ serverSessions })(
    ({ serverSessions }) =>
      !!session && (
        <>
          {mcp && (
            <>
              <Entity.Wrapper>
                <Entity.Content>
                  <Entity.Field
                    title="Client"
                    value={[mcp.client?.name, mcp.client?.version].filter(Boolean).join('@')}
                  />
                  <Entity.Field
                    title="Server"
                    value={[mcp.server?.name, mcp.server?.version].filter(Boolean).join('@')}
                  />

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

              ...session.serverDeployments.map(serverDeployment => ({
                component: (
                  <Entry
                    icon={<RiCornerUpRightDoubleLine />}
                    title={`Server deployment ${serverDeployment.name ?? serverDeployment.server.name} connected`}
                    time={session.createdAt}
                  />
                ),
                time: session.createdAt
              })),

              ...serverSessions.data.items.map((serverSession, i) => ({
                component: <ServerSession serverSession={serverSession} />,
                time: serverSession.createdAt
              }))
            ]}
          />

          {serverSessions.data.items.length == 0 && (
            <>
              <Spacer height={20} />

              <Callout color="gray">
                You have not connected to this session yet. Once you create an MCP connection,
                you will be able to view message logs and errors.
              </Callout>
            </>
          )}
        </>
      )
  );
};

import { renderWithLoader } from '@metorial/data-hooks';
import { SessionsGetOutput } from '@metorial/generated';
import { useCurrentInstance, useSessionServerSessions } from '@metorial/state';
import { Callout, Entity, Spacer } from '@metorial/ui';
import { RiCornerUpRightDoubleLine } from '@remixicon/react';
import { useMemo } from 'react';
import { Entry } from './components/entry';
import { ItemList } from './components/itemList';
import { ServerSession } from './components/serverSession';

export let SessionEvents = ({ session }: { session: SessionsGetOutput }) => {
  let instance = useCurrentInstance();

  let serverSessions = useSessionServerSessions(instance.data?.id, session.id, {
    limit: 100,
    order: 'asc'
  });

  let client = useMemo(
    () => (serverSessions.data?.items ?? []).map(s => s.mcp.client).find(Boolean) ?? undefined,
    [serverSessions.data?.items]
  );

  return renderWithLoader({ serverSessions })(({ serverSessions }) => (
    <>
      {client && (
        <Entity.Wrapper>
          <Entity.Content>
            <Entity.Field title={client.name} />
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
            You have not connected to this session yet. Once you create an MCP connection, you
            will be able to view message logs and errors.
          </Callout>
        </>
      )}
    </>
  ));
};

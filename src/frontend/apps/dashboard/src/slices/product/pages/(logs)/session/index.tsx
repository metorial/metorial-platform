import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useSession, useSessionServerSessions } from '@metorial/state';
import { RiCornerUpRightDoubleLine } from '@remixicon/react';
import { useParams } from 'react-router-dom';
import { Entry } from './components/entry';
import { ItemList } from './components/itemList';
import { ServerSession } from './components/serverSession';
import { useLock } from './hooks/useLock';

export let SessionPage = () => {
  let instance = useCurrentInstance();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);
  let serverSessions = useSessionServerSessions(instance.data?.id, sessionId, {
    limit: 100,
    order: 'asc'
  });

  let lock = useLock();

  return renderWithLoader({ session, serverSessions })(({ session, serverSessions }) => (
    <ItemList
      items={[
        {
          component: (
            <Entry
              icon={<RiCornerUpRightDoubleLine />}
              title="Session created"
              time={session.data.createdAt}
            />
          ),
          time: session.data.createdAt
        },

        ...(serverSessions.data?.items ?? []).map((serverSession, i) => ({
          component: <ServerSession serverSession={serverSession} useLock={lock.useLock} />,
          time: serverSession.createdAt
        }))
      ]}
    />
  ));
};

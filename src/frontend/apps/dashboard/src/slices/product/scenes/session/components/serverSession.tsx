import { renderWithLoader } from '@metorial/data-hooks';
import { SessionsServerSessionsGetOutput } from '@metorial/generated';
import { useCurrentInstance, useServerRuns } from '@metorial/state';
import { theme } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiRadarLine, RiServerLine } from '@remixicon/react';
import { useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useEvents } from '../hooks/useEvents';
import { Entry } from './entry';
import { ItemList } from './itemList';

let Wrapper = styled.div`
  border-radius: 8px;
  border: 1px solid ${theme.colors.gray400};
  background: ${theme.colors.background};
  overflow: hidden;
  margin-left: -20px;
  margin-right: -20px;
`;

let Header = styled.header`
  border-bottom: 1px solid ${theme.colors.gray400};
  /* background: ${theme.colors.gray100}; */
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${theme.colors.gray800};

  span {
    font-size: 12px;
    font-weight: 500;
  }
`;

let Main = styled.main`
  padding: 20px;
`;

export let ServerSession = ({
  serverSession
}: {
  serverSession: SessionsServerSessionsGetOutput;
}) => {
  let ref = useRef<HTMLDivElement>(null);
  let inView = useInView(ref, {});

  let [canFetch, setCanFetch] = useState(false);

  useEffect(() => {
    if (inView) setCanFetch(true);
  }, [inView]);

  let instance = useCurrentInstance();
  let serverRuns = useServerRuns(canFetch ? instance.data?.id : undefined, {
    serverSessionIds: [serverSession.id],
    limit: 100
  });

  let eventItems = useEvents(canFetch ? serverSession.session.id : undefined, {
    serverSessionIds: [serverSession.id],
    limit: 100
  });

  if (serverRuns.data?.items.length === 0) return null;

  return (
    <Wrapper ref={ref} style={{ height: canFetch ? 'auto' : 500 }}>
      <Header>
        <span>{serverSession.serverDeployment.name ?? serverSession.server.name}</span>
        <span>
          <ID id={serverSession.id} />
        </span>
      </Header>

      <Main>
        {renderWithLoader({ serverRuns })(({ serverRuns }) => (
          <ItemList
            items={[
              {
                component: (
                  <Entry
                    icon={<RiRadarLine />}
                    title={`Client connected`}
                    time={serverSession.createdAt}
                  />
                ),
                time: serverSession.createdAt
              },

              ...serverRuns.data.items.flatMap(serverRun => [
                {
                  component: (
                    <Entry
                      title={`Server ${serverRun.serverDeployment.name ?? serverRun.server.name} started`}
                      icon={<RiServerLine />}
                      time={serverRun.startedAt ?? serverRun.createdAt}
                    />
                  ),
                  time: serverRun.startedAt ?? serverRun.createdAt
                },

                serverRun.stoppedAt && {
                  component: (
                    <Entry
                      title={`Server ${serverRun.serverDeployment.name ?? serverRun.server.name} stopped`}
                      icon={<RiServerLine />}
                      time={serverRun.startedAt ?? serverRun.createdAt}
                    />
                  ),
                  time: serverRun.stoppedAt
                }
              ]),

              ...eventItems
            ]}
          />
        ))}
      </Main>
    </Wrapper>
  );
};

import { renderWithLoader } from '@metorial/data-hooks';
import { DashboardInstanceSessionsServerSessionsGetOutput } from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { useCurrentInstance, useServerRuns } from '@metorial/state';
import { Button, theme } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import {
  RiArrowDownLine,
  RiRadarLine,
  RiSendPlane2Line,
  RiServerLine
} from '@remixicon/react';
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

  &[data-collapsed='true'] {
    height: 900px !important;
    overflow: hidden;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 300px;
      z-index: 1;
      background: linear-gradient(
        to bottom,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 1) 90%
      );
    }

    .expand {
      position: absolute;
      bottom: 20px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      gap: 10px;
      z-index: 2;

      svg {
        color: ${theme.colors.gray400};
      }
    }
  }
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
  serverSession: DashboardInstanceSessionsServerSessionsGetOutput;
}) => {
  let ref = useRef<HTMLDivElement>(null);
  let inView = useInView(ref, {});

  let [canFetch, setCanFetch] = useState(false);
  let [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    if (inView) setCanFetch(true);
  }, [inView]);

  let instance = useCurrentInstance();
  let serverRuns = useServerRuns(canFetch ? instance.data?.id : undefined, {
    serverSessionId: [serverSession.id],
    limit: 100
  });

  let eventItems = useEvents(canFetch ? serverSession.session.id : undefined, {
    serverSessionId: [serverSession.id],
    limit: 100
  });

  return (
    <div ref={ref}>
      {renderWithLoader({ serverRuns, eventItems })(() => (
        <Wrapper data-collapsed={isCollapsed}>
          {isCollapsed && (
            <div className="expand">
              <RiArrowDownLine />

              <Button size="2" onClick={() => setIsCollapsed(false)}>
                Expand Session Connection
              </Button>
            </div>
          )}

          <Header>
            <span>{serverSession.serverDeployment.name ?? serverSession.server.name}</span>
            <span>
              <ID id={serverSession.connection?.id ?? serverSession.id} />
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

                  ...(serverSession.connection
                    ? [
                        {
                          component: (
                            <Entry
                              icon={<RiSendPlane2Line />}
                              title={`Session connection created`}
                              time={serverSession.createdAt}
                            />
                          ),
                          time: serverSession.createdAt
                        }
                      ]
                    : []),

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
                          time={serverRun.stoppedAt}
                        />
                      ),
                      time: serverRun.stoppedAt
                    }
                  ]),

                  ...eventItems.data
                ]}
              />
            ))}
          </Main>
        </Wrapper>
      ))}
    </div>
  );
};

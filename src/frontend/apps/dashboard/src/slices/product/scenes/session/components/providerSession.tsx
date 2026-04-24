import { DashboardInstanceSessionsProvidersGetOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProviderInvocations,
  useProviderRuns
} from '@metorial/state';
import { Button, theme } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import {
  RiArrowDownLine,
  RiRadarLine,
  RiSendPlane2Line,
  RiServerLine
} from '@remixicon/react';
import { useInView } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { ProviderInvocationEntry } from '../../providerInvocations';
import { useEvents } from '../hooks/useEvents';
import { Entry } from './entry';
import { ItemList } from './itemList';
import { ProviderRunLogs } from './providerRunLogs';

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

export let ProviderSession = ({
  providerSession
}: {
  providerSession: DashboardInstanceSessionsProvidersGetOutput;
}) => {
  let ref = useRef<HTMLDivElement>(null);
  let inView = useInView(ref, {});

  let [canFetch, setCanFetch] = useState(false);
  let [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    if (inView) setCanFetch(true);
  }, [inView]);

  let instance = useCurrentInstance();
  let providerRuns = useProviderRuns(
    canFetch ? instance.data?.id : undefined,
    canFetch ? providerSession.sessionId : undefined,
    {
      limit: 100
    }
  );

  let providerRunIds = useMemo(
    () => providerRuns.data?.items.map(run => run.id) ?? [],
    [providerRuns.data?.items]
  );

  let providerInvocations = useProviderInvocations(
    canFetch && instance.data?.id && providerRunIds.length > 0
      ? instance.data.id
      : undefined,
    providerRunIds.length > 0 ? { providerRunId: providerRunIds } : undefined
  );

  let eventItems = useEvents(canFetch ? providerSession.sessionId : undefined, {
    providerSessionId: [providerSession.id],
    limit: 100
  });

  return (
    <div ref={ref}>
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
          <span>
            {providerSession.deployment?.name ?? providerSession.providerId ?? 'Unknown'}
          </span>
          <span>
            <ID id={providerSession.id} />
          </span>
        </Header>

        <Main>
          {renderWithLoader({ providerRuns, eventItems })(({ providerRuns, eventItems }) => {
            let invocationItems = providerInvocations.data?.items ?? [];
            let hasInvocations = invocationItems.length > 0;

            let items = [
              {
                component: (
                  <Entry
                    icon={<RiRadarLine />}
                    title={`Client connected`}
                    time={providerSession.createdAt}
                  />
                ),
                time: providerSession.createdAt
              },

              {
                component: (
                  <Entry
                    icon={<RiSendPlane2Line />}
                    title={`Session connection created`}
                    time={providerSession.createdAt}
                  />
                ),
                time: providerSession.createdAt
              },

              ...providerRuns.data.items.flatMap(providerRun => [
                {
                  component: (
                    <Entry
                      title={`Provider ${providerRun.providerId ?? 'Unknown'} started`}
                      icon={<RiServerLine />}
                      time={providerRun.createdAt}
                    />
                  ),
                  time: providerRun.createdAt
                },

                providerRun.completedAt && {
                  component: (
                    <Entry
                      title={`Provider ${providerRun.providerId ?? 'Unknown'} stopped`}
                      icon={<RiServerLine />}
                      time={providerRun.completedAt}
                    />
                  ),
                  time: providerRun.completedAt
                }
              ]),

              ...invocationItems.map(invocation => ({
                component: <ProviderInvocationEntry invocation={invocation} />,
                time: invocation.createdAt
              })),

              ...eventItems.data
            ];

            if (isCollapsed) {
              items = items.slice(0, 10);
            }

            return (
              <>
                <ItemList items={items} />
                {!hasInvocations &&
                  providerRuns.data.items.map(run => (
                    <div key={run.id} style={{ marginTop: 16 }}>
                      <ProviderRunLogs providerRunId={run.id} lazy />
                    </div>
                  ))}
              </>
            );
          })}
        </Main>
      </Wrapper>
    </div>
  );
};

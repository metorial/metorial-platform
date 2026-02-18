import { ServerRunsGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { useCurrentInstance, useProvider, useSessionErrors } from '@metorial/state';
import { Button, Callout, Spacer, theme } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiArrowDownLine, RiServerLine } from '@remixicon/react';
import { useState } from 'react';
import styled from 'styled-components';
import { Entry } from '../session/components/entry';
import { ItemList } from '../session/components/itemList';
import { useEvents } from '../session/hooks/useEvents';

let Wrapper = styled.div`
  border-radius: 8px;
  border: 1px solid ${theme.colors.gray400};
  background: ${theme.colors.background};
  overflow: hidden;

  &[data-collapsed='true'] {
    max-height: 900px;
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

export let ServerRunEvents = ({ serverRun }: { serverRun: ServerRunsGetOutput }) => {
  let instance = useCurrentInstance();
  let [isCollapsed, setIsCollapsed] = useState(true);

  let sessionId =
    (serverRun as any)?.sessionId ?? (serverRun as any)?.serverSession?.sessionId;

  let errors = useSessionErrors(serverRun ? instance.data?.id : null, serverRun?.id ?? '');
  let error = errors.data?.items[0];

  let eventItems = useEvents(sessionId, {
    serverRunId: serverRun?.id
  });

  let providerId = (serverRun as any)?.providerId ?? serverRun?.serverDeployment?.server?.id;
  let provider = useProvider(instance.data?.id, providerId);
  let providerName =
    provider.data?.name ??
    serverRun?.serverDeployment?.name ??
    (serverRun as any)?.server?.name ??
    providerId ??
    'Unknown';
  let startTime = (serverRun as any)?.startedAt ?? serverRun?.createdAt;
  let endTime = (serverRun as any)?.completedAt ?? (serverRun as any)?.stoppedAt;

  let allItems = [
    {
      component: <Entry title="Provider started" icon={<RiServerLine />} time={startTime} />,
      time: startTime
    },

    ...eventItems.data,

    endTime && {
      component: <Entry title="Provider stopped" icon={<RiServerLine />} time={endTime} />,
      time: endTime
    }
  ];

  let displayItems = isCollapsed ? allItems.slice(0, 10) : allItems;

  return (
    <>
      {error && (
        <>
          <Callout color="red">
            Provider run failed with error: {error.message} (
            {(error as any).code ?? (error as any).type})
          </Callout>
          <Spacer height={20} />
        </>
      )}

      <Wrapper data-collapsed={isCollapsed && allItems.length > 10}>
        {isCollapsed && allItems.length > 10 && (
          <div className="expand">
            <RiArrowDownLine />
            <Button size="2" onClick={() => setIsCollapsed(false)}>
              Expand Provider Run
            </Button>
          </div>
        )}

        <Header>
          <span>{providerName}</span>
          <span>
            <ID id={serverRun.id} />
          </span>
        </Header>

        <Main>
          <ItemList items={displayItems} />
        </Main>
      </Wrapper>
    </>
  );
};

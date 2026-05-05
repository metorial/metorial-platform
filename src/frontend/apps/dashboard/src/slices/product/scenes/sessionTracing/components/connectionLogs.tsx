import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import { Callout, CenteredSpinner } from '@metorial/ui';
import { useEffect } from 'react';
import styled from 'styled-components';
import { ItemList } from '../../session/components/itemList';
import { useConnectionTimeline } from '../hooks/useConnectionTimeline';
import { SessionConnection } from '../types';
import { ConnectionTraceHeader } from './connectionTraceHeader';

let DetailContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: #fafafa;
  min-height: 100%;
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
  connection,
  focusedItemId
}: {
  session: DashboardInstanceSessionsGetOutput;
  connection: SessionConnection;
  focusedItemId?: string | null;
}) => {
  let {
    connection: connectionDetails,
    connectionProviders,
    hasTimelineActivity,
    isLoading,
    mcp,
    sessionEntry,
    timelineItems
  } = useConnectionTimeline({
    session,
    connection
  });

  useEffect(() => {
    if (!focusedItemId) return;

    let id = window.requestAnimationFrame(() => {
      let element = document.querySelector(
        `[data-timeline-item-id="${focusedItemId}"]`
      ) as HTMLElement | null;
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    return () => window.cancelAnimationFrame(id);
  }, [focusedItemId, timelineItems]);

  return (
    <DetailContent>
      <ConnectionTraceHeader
        connection={connectionDetails}
        mcp={mcp}
        providers={connectionProviders}
        session={session}
      />

      <DetailTimeline>
        {sessionEntry}

        <ItemList items={timelineItems} selectedItemId={focusedItemId} />

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

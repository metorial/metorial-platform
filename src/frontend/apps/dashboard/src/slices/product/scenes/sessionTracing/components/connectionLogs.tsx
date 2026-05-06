import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import { Callout, CenteredSpinner } from '@metorial/ui';
import { useEffect, useRef } from 'react';
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
  let handledFocusKeysRef = useRef(new Set<string>());

  useEffect(() => {
    if (!focusedItemId) return;
    let focusKey = `${connection.id}:${focusedItemId}`;
    if (handledFocusKeysRef.current.has(focusKey)) return;

    let id = window.requestAnimationFrame(() => {
      let element = document.querySelector(
        `[data-timeline-item-id="${focusedItemId}"]`
      ) as HTMLElement | null;
      if (!element) return;

      handledFocusKeysRef.current.add(focusKey);
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return () => window.cancelAnimationFrame(id);
  }, [connection.id, focusedItemId, timelineItems]);

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

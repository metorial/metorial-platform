import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import { Callout, CenteredSpinner } from '@metorial/ui';
import { RefObject, useCallback, useEffect, useMemo, useRef } from 'react';
import styled from 'styled-components';
import { useConnectionTimeline } from '../hooks/useConnectionTimeline';
import { SessionConnection } from '../types';
import { ConnectionTraceHeader } from './connectionTraceHeader';
import { VirtualizedTimelineList } from './virtualizedTimelineList';

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
  connection,
  focusedItemId,
  scrollRef,
  session
}: {
  connection: SessionConnection;
  focusedItemId?: string | null;
  scrollRef: RefObject<HTMLElement | null>;
  session: DashboardInstanceSessionsGetOutput;
}) => {
  let {
    connection: connectionDetails,
    connectionProviders,
    hasMoreAfter,
    hasTimelineActivity,
    isLoading,
    isLoadingMore,
    loadMore,
    mcp,
    timelineItemData,
    timelineRowContext
  } = useConnectionTimeline({
    session,
    connection
  });
  let sortedTimelineItemData = useMemo(
    () => [...timelineItemData].sort((a, b) => a.time.getTime() - b.time.getTime()),
    [timelineItemData]
  );
  let handledFocusKeysRef = useRef(new Set<string>());
  let scrollToIndexRef = useRef<(index: number) => void>(() => {});

  let handleScrollToIndexReady = useCallback((scrollToIndex: (index: number) => void) => {
    scrollToIndexRef.current = scrollToIndex;
  }, []);

  useEffect(() => {
    if (!focusedItemId) return;
    let focusKey = `${connection.id}:${focusedItemId}`;
    if (handledFocusKeysRef.current.has(focusKey)) return;

    let index = sortedTimelineItemData.findIndex(item => item.id === focusedItemId);
    if (index < 0) return;

    let id = window.requestAnimationFrame(() => {
      scrollToIndexRef.current(index);
      handledFocusKeysRef.current.add(focusKey);
    });

    return () => window.cancelAnimationFrame(id);
  }, [connection.id, focusedItemId, sortedTimelineItemData]);

  return (
    <DetailContent>
      <ConnectionTraceHeader
        connection={connectionDetails}
        mcp={mcp}
        providers={connectionProviders}
        session={session}
      />

      <DetailTimeline>
        <VirtualizedTimelineList
          context={timelineRowContext}
          focusedItemId={focusedItemId}
          hasMoreAfter={hasMoreAfter}
          isLoadingMore={isLoadingMore}
          items={timelineItemData}
          loadMore={loadMore}
          onScrollToIndexReady={handleScrollToIndexReady}
          scrollRef={scrollRef}
        />

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

        {isLoadingMore && hasTimelineActivity && (
          <LoadingWrap>
            <CenteredSpinner size={16} />
          </LoadingWrap>
        )}
      </DetailTimeline>
    </DetailContent>
  );
};

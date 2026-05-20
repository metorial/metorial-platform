import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { RefObject, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { TimelineItemData, TimelineRowContext } from '../types';
import { TimelineItemRow } from './timelineItemRow';

let ListWrapper = styled.div`
  position: relative;
  width: 100%;
`;

let ItemWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  padding-bottom: 20px;

  &[data-selected='true'] {
    scroll-margin-top: 16px;
    border-radius: 8px;
    outline: 2px solid rgba(59, 130, 246, 0.35);
    outline-offset: 6px;
  }
`;

export let VirtualizedTimelineList = ({
  context,
  focusedItemId,
  hasMoreAfter,
  isLoadingMore,
  items,
  loadMore,
  onScrollToIndexReady,
  scrollRef
}: {
  context: TimelineRowContext;
  focusedItemId?: string | null;
  hasMoreAfter?: boolean;
  isLoadingMore?: boolean;
  items: TimelineItemData[];
  loadMore?: () => void;
  onScrollToIndexReady?: (scrollToIndex: (index: number) => void) => void;
  scrollRef: RefObject<HTMLElement | null>;
}) => {
  let sortedItems = useMemo(
    () => [...items].sort((a, b) => a.time.getTime() - b.time.getTime()),
    [items]
  );

  let virtualizer = useVirtualizer({
    count: sortedItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 8,
    measureElement: (element: Element) => element.getBoundingClientRect().height,
    onChange: instance => {
      if (!loadMore || !hasMoreAfter || isLoadingMore) return;
      let virtualItems = instance.getVirtualItems();
      if (!virtualItems.length) return;
      if (virtualItems[0]?.index <= 2) loadMore();
    }
  });

  useEffect(() => {
    if (!onScrollToIndexReady) return;
    onScrollToIndexReady(index => {
      virtualizer.scrollToIndex(index, { align: 'start', behavior: 'smooth' });
    });
  }, [onScrollToIndexReady, virtualizer]);

  return (
    <ListWrapper style={{ height: `${virtualizer.getTotalSize()}px` }}>
      {virtualizer.getVirtualItems().map((virtualRow: VirtualItem) => {
        let item = sortedItems[virtualRow.index];
        if (!item) return null;

        return (
          <ItemWrapper
            key={item.id}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            data-selected={focusedItemId && item.id === focusedItemId ? 'true' : undefined}
            data-timeline-item-id={item.id}
            style={{
              transform: `translateY(${virtualRow.start}px)`
            }}
          >
            <TimelineItemRow context={context} item={item} />
          </ItemWrapper>
        );
      })}
    </ListWrapper>
  );
};

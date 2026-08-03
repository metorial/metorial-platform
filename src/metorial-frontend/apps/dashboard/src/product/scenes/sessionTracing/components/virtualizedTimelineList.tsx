import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import styled from 'styled-components';
import { TimelineItemData, TimelineRowContext } from '../types';
import { TimelineItemRow } from './timelineItemRow';

let ListWrapper = styled.div`
  position: relative;
  width: 100%;
  min-height: 1px;
`;

let ItemWrapper = styled.div`
  position: absolute;
  box-sizing: border-box;
  contain: layout paint;
  top: 0;
  left: 0;
  width: 100%;
  padding-bottom: 20px;
  will-change: transform;

  &[data-selected='true'] {
    scroll-margin-top: 16px;
    border-radius: 8px;
    outline: 2px solid rgba(59, 130, 246, 0.35);
    outline-offset: 6px;
  }
`;

let getTimelineItemKey = (item: TimelineItemData) => `${item.kind}:${item.id}`;

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
  let itemKeys = useMemo(() => sortedItems.map(getTimelineItemKey), [sortedItems]);
  let itemSignature = useMemo(() => itemKeys.join('\n'), [itemKeys]);
  let rowElementsRef = useRef(new Map<string, HTMLDivElement>());
  let rowObserversRef = useRef(new Map<string, ResizeObserver>());

  let virtualizer = useVirtualizer({
    count: sortedItems.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: index => itemKeys[index] ?? index,
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

  let cleanupObservedRow = useCallback((key: string) => {
    rowObserversRef.current.get(key)?.disconnect();
    rowObserversRef.current.delete(key);
    rowElementsRef.current.delete(key);
  }, []);

  let measureRowElement = useCallback(
    (key: string, element: HTMLDivElement | null) => {
      let previousElement = rowElementsRef.current.get(key);
      if (previousElement && previousElement !== element) cleanupObservedRow(key);

      if (!element) {
        cleanupObservedRow(key);
        return;
      }

      rowElementsRef.current.set(key, element);
      virtualizer.measureElement(element);

      if (rowObserversRef.current.has(key) || typeof ResizeObserver === 'undefined') {
        return;
      }

      let observer = new ResizeObserver(() => {
        virtualizer.measureElement(element);
      });
      observer.observe(element);
      rowObserversRef.current.set(key, observer);
    },
    [cleanupObservedRow, virtualizer]
  );

  useLayoutEffect(() => {
    virtualizer.measure();

    let id = window.requestAnimationFrame(() => {
      virtualizer.measure();
    });

    return () => window.cancelAnimationFrame(id);
  }, [itemSignature, virtualizer]);

  useEffect(
    () => () => {
      for (let observer of rowObserversRef.current.values()) observer.disconnect();
      rowObserversRef.current.clear();
      rowElementsRef.current.clear();
    },
    []
  );

  useEffect(() => {
    if (!onScrollToIndexReady) return;
    onScrollToIndexReady(index => {
      virtualizer.measure();
      window.requestAnimationFrame(() => {
        virtualizer.scrollToIndex(index, { align: 'start', behavior: 'smooth' });
      });
    });
  }, [onScrollToIndexReady, virtualizer]);

  return (
    <ListWrapper style={{ height: `${Math.max(virtualizer.getTotalSize(), 1)}px` }}>
      {virtualizer.getVirtualItems().map((virtualRow: VirtualItem) => {
        let item = sortedItems[virtualRow.index];
        if (!item) return null;
        let itemKey = getTimelineItemKey(item);

        return (
          <ItemWrapper
            key={itemKey}
            data-index={virtualRow.index}
            ref={element => measureRowElement(itemKey, element)}
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

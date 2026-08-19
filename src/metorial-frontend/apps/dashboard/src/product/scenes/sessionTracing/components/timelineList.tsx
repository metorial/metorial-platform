import { RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import styled from 'styled-components';
import { useRowVirtualization } from '../hooks/useRowVirtualization';
import { TimelineItemData, TimelineRowContext } from '../types';
import { TimelineRow } from './timelineRow';

let ListWrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

let LoadMoreSentinel = styled.div`
  height: 1px;
`;

let getTimelineItemKey = (item: TimelineItemData) => `${item.kind}:${item.id}`;

export let TimelineList = ({
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
  /** Must already be sorted ascending by `time`. */
  items: TimelineItemData[];
  loadMore?: () => void;
  onScrollToIndexReady?: (scrollToIndex: (index: number) => void) => void;
  scrollRef: RefObject<HTMLElement | null>;
}) => {
  let itemKeys = useMemo(() => items.map(getTimelineItemKey), [items]);
  let sentinelRef = useRef<HTMLDivElement | null>(null);
  let scrollHeightBeforeLoadRef = useRef<number | null>(null);
  let previousItemKeysRef = useRef<string[]>([]);

  let {
    activeKeys,
    activateKeys,
    forceActiveKey,
    setForceActiveKey,
    registerRow,
    heightCache,
    elementByKey
  } = useRowVirtualization({ scrollRef });
  let forceActiveKeyRef = useRef(forceActiveKey);
  forceActiveKeyRef.current = forceActiveKey;

  useLayoutEffect(() => {
    let previousKeys = previousItemKeysRef.current;
    previousItemKeysRef.current = itemKeys;

    let scrollEl = scrollRef.current;
    if (!scrollEl || scrollHeightBeforeLoadRef.current == null) return;

    // This update is the direct result of a loadMore() we triggered --
    // activate the newly-prepended rows synchronously (real content, not
    // generic estimates) before measuring scrollHeight, so the scroll
    // compensation below accounts for their true height instead of leaving
    // a second, uncompensated pop once the visibility observer catches up
    // asynchronously later.
    let previousKeySet = new Set(previousKeys);
    let newlyAddedKeys = itemKeys.filter(key => !previousKeySet.has(key));
    if (newlyAddedKeys.length) flushSync(() => activateKeys(newlyAddedKeys));

    let heightDiff = scrollEl.scrollHeight - scrollHeightBeforeLoadRef.current;
    if (heightDiff > 0) scrollEl.scrollTop += heightDiff;
    scrollHeightBeforeLoadRef.current = null;
  }, [activateKeys, itemKeys, scrollRef]);

  useEffect(() => {
    let sentinel = sentinelRef.current;
    let scrollEl = scrollRef.current;
    if (!sentinel || !scrollEl || !loadMore || !hasMoreAfter) return;

    let observer = new IntersectionObserver(
      entries => {
        if (!entries[0]?.isIntersecting || isLoadingMore) return;
        scrollHeightBeforeLoadRef.current = scrollEl.scrollHeight;
        loadMore();
      },
      { root: scrollEl, rootMargin: '200px 0px 0px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreAfter, isLoadingMore, loadMore, scrollRef]);

  let handleMeasured = useCallback(
    (key: string, _height: number) => {
      if (key !== forceActiveKeyRef.current) return;
      elementByKey.current.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [elementByKey]
  );

  useEffect(() => {
    if (!onScrollToIndexReady) return;
    onScrollToIndexReady(index => {
      let itemKey = itemKeys[index];
      if (!itemKey) return;

      setForceActiveKey(itemKey);

      window.requestAnimationFrame(() => {
        elementByKey.current
          .get(itemKey)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, [elementByKey, itemKeys, onScrollToIndexReady, setForceActiveKey]);

  return (
    <ListWrapper>
      {hasMoreAfter && <LoadMoreSentinel ref={sentinelRef} />}

      {items.map((item, index) => {
        let itemKey = itemKeys[index];

        return (
          <TimelineRow
            key={itemKey}
            item={item}
            context={context}
            itemKey={itemKey}
            active={activeKeys.has(itemKey) || forceActiveKey === itemKey}
            isSelected={!!focusedItemId && item.id === focusedItemId}
            heightCache={heightCache}
            registerRow={registerRow}
            onMeasured={handleMeasured}
          />
        );
      })}
    </ListWrapper>
  );
};

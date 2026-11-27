import { memo, MutableRefObject, useLayoutEffect, useRef } from 'react';
import styled from 'styled-components';
import { TimelineItemData, TimelineRowContext } from '../types';
import { TimelineItemRow } from './timelineItemRow';
import { getEstimatedRowHeight } from './timelineRowHeightEstimates';

let ItemWrapper = styled.div`
  box-sizing: border-box;
  padding-bottom: 20px;

  &[data-selected='true'] {
    scroll-margin-top: 16px;
    border-radius: 8px;
    outline: 2px solid rgba(59, 130, 246, 0.35);
    outline-offset: 6px;
  }
`;

// No floor is ever applied to this node -- it's the only thing we ever call
// getBoundingClientRect()/ResizeObserver on, so a measurement can never be
// contaminated by (and "prove correct") a floor we applied ourselves.
let ContentWrapper = styled.div``;

export let TimelineRow = memo(
  ({
    item,
    context,
    itemKey,
    active,
    isSelected,
    heightCache,
    registerRow,
    onMeasured
  }: {
    item: TimelineItemData;
    context: TimelineRowContext;
    itemKey: string;
    active: boolean;
    isSelected: boolean;
    heightCache: MutableRefObject<Map<string, number>>;
    registerRow: (key: string, element: HTMLDivElement | null) => void;
    onMeasured?: (key: string, height: number) => void;
  }) => {
    let wrapperRef = useRef<HTMLDivElement | null>(null);
    let contentRef = useRef<HTMLDivElement | null>(null);
    let resizeObserverRef = useRef<ResizeObserver | null>(null);

    let applyFloor = () => {
      let wrapper = wrapperRef.current;
      if (!wrapper) return;
      wrapper.style.minHeight = `${getEstimatedRowHeight(heightCache.current, itemKey, item.kind)}px`;
    };

    // The reserved floor is always applied -- on mount, while active, and
    // while inactive -- and is only ever driven by real measurements of the
    // unfloored content node below (or a per-kind estimate before the row
    // has ever been measured). It's never cleared, so a row leaving the
    // active window simply freezes at whatever it last measured.
    useLayoutEffect(() => {
      applyFloor();
    }, [itemKey, item.kind, heightCache]);

    useLayoutEffect(() => {
      let content = contentRef.current;
      if (!active || !content) {
        resizeObserverRef.current?.disconnect();
        resizeObserverRef.current = null;
        return;
      }

      let recordAndApply = (height: number) => {
        heightCache.current.set(itemKey, height);
        applyFloor();
        onMeasured?.(itemKey, height);
      };

      recordAndApply(content.getBoundingClientRect().height);

      if (typeof ResizeObserver !== 'undefined') {
        let observer = new ResizeObserver(entries => {
          let entry = entries[0];
          if (!entry) return;
          let measured = entry.contentBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
          recordAndApply(measured);
        });
        observer.observe(content);
        resizeObserverRef.current = observer;
      }

      return () => {
        resizeObserverRef.current?.disconnect();
        resizeObserverRef.current = null;
      };
    }, [active, itemKey, item.kind, heightCache, onMeasured]);

    return (
      <ItemWrapper
        ref={element => {
          wrapperRef.current = element;
          registerRow(itemKey, element);
        }}
        data-selected={isSelected ? 'true' : undefined}
        data-timeline-item-id={item.id}
      >
        {active && (
          <ContentWrapper ref={contentRef}>
            <TimelineItemRow context={context} item={item} />
          </ContentWrapper>
        )}
      </ItemWrapper>
    );
  }
);

TimelineRow.displayName = 'TimelineRow';

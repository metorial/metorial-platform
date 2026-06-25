import { useIsSSR } from '@looped/hooks';
import React, { useState } from 'react';
import { useWindowSize } from 'react-use';
import { styled } from 'styled-components';
import { theme } from '..';
import { getLink } from '../link';

let Wrapper = styled('div')`
  position: relative;
  width: 100%;
  user-select: none;
`;

let Inner = styled('div')`
  display: flex;
  padding: 0;
  margin: 0;
  /* gap: PADDINGpx; */
  border-bottom: 1px solid ${theme.colors.gray400};
  /* padding-bottom: 6px; */
  overflow-x: auto;
  white-space: nowrap;
  justify-content: center;
  scrollbar-color: ${theme.colors.gray400} transparent;
  scrollbar-width: thin;
`;

let List = styled('ul')`
  list-style: none;
  display: flex;
  max-width: 100%;
  overflow-x: auto;
  white-space: nowrap;
  scrollbar-color: ${theme.colors.gray400} transparent;
  scrollbar-width: thin;
`;

let Tab = styled('li')`
  position: relative;
  z-index: 10;

  button,
  a {
    /* height: 30px; */
    font-size: 14px;
    font-weight: 500;
    color: ${theme.colors.gray700};
    text-decoration: none;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    background: none;
    border: none;
    padding: 0;

    &:hover {
      color: ${theme.colors.blue900};
    }
  }
`;

let LineIndicator = styled('div')`
  position: absolute;
  bottom: -1px;
  height: 3px;
  background: ${theme.colors.blue900};
  transition: all 0.3s ease;
  border-radius: 7px;
`;

let TabIndicator = styled('div')`
  position: absolute;
  transform: translateY(-50%);
  /* height: 30px; */
  transition: all 0.3s ease;
  border-radius: 7px;
  z-index: 0;
`;

export let Tabs = ({
  current,
  tabs,
  action,

  tabIndicator = true,
  lineIndicator = true,

  height = 30,
  gap = 20,
  padding: paddingRaw = {},

  margin = {
    bottom: 20,
    top: 0
  },

  variant = 'soft',
  maxWidth = '100%'
}: {
  current: string;
  tabs: ({ label: string } & (
    | {
        id: string;
      }
    | {
        to: string;
      }
  ))[];
  action: (id: string) => void;

  gap?: number;
  padding?: {
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  };

  margin?: {
    bottom?: number;
    top?: number;
  };

  tabIndicator?: boolean;
  lineIndicator?: boolean;
  height?: number;

  variant?: 'soft' | 'outline';
  maxWidth?: number | string;
}) => {
  let Link = getLink();
  let isServer = useIsSSR();

  // Rerender on window resize
  useWindowSize();

  let padding = {
    left: paddingRaw.left ?? 0,
    right: paddingRaw.right ?? 0,
    top: paddingRaw.top ?? 0,
    bottom: paddingRaw.bottom ?? 6
  };

  let [listRef, setListRef] = useState<HTMLUListElement | null>(null);
  let [innerRef, setInnerRef] = useState<HTMLDivElement | null>(null);
  let [wrapperRef, setWrapperRef] = useState<HTMLDivElement | null>(null);
  let [scrollOffset, setScrollOffset] = useState(0);

  let [refs, setRefs] = useState<(HTMLLIElement | null)[]>([]);

  let renderIndicators = false;

  let currentIndex = tabs.findIndex(t => ('to' in t ? t.to == current : t.id == current));
  let indicatorOffset = -scrollOffset;
  let indicatorWidth = refs[currentIndex]?.clientWidth ?? 0;
  if (refs[currentIndex] && wrapperRef) {
    renderIndicators = true;

    let tabRect = refs[currentIndex].getBoundingClientRect();
    let wrapperRect = wrapperRef.getBoundingClientRect();

    indicatorOffset = tabRect.left - wrapperRect.left;
    indicatorWidth = tabRect.width;
  }

  let clipIndicator = (indicator: { left: number; width: number }) => {
    let overflowThreshold = 10;
    let minLeft = -overflowThreshold;
    let maxRight = (wrapperRef?.clientWidth ?? 0) + overflowThreshold;
    let right = indicator.left + indicator.width;
    let clippedLeft = Math.max(indicator.left, minLeft);
    let clippedRight = Math.min(right, maxRight);

    return {
      left: clippedLeft,
      width: Math.max(clippedRight - clippedLeft, 0),
      visible: clippedRight - clippedLeft >= 30
    };
  };

  let clippedLineIndicator = clipIndicator({
    left: indicatorOffset,
    width: indicatorWidth
  });
  let clippedTabIndicator = clipIndicator({
    left: indicatorOffset - gap / 2,
    width: indicatorWidth + gap
  });

  return (
    <Wrapper ref={setWrapperRef}>
      <Inner
        ref={setInnerRef}
        onScroll={e =>
          setScrollOffset(e.currentTarget.scrollLeft + (listRef?.scrollLeft ?? 0))
        }
        style={{
          width: '100%',

          paddingLeft: padding.left,
          paddingRight: padding.right,
          paddingTop: padding.top,
          paddingBottom: padding.bottom,

          marginBottom: margin.bottom,
          marginTop: margin.top
        }}
      >
        <List
          ref={setListRef}
          onScroll={e =>
            setScrollOffset((innerRef?.scrollLeft ?? 0) + e.currentTarget.scrollLeft)
          }
          style={{
            width: maxWidth,
            gap
          }}
        >
          {tabs.map((item, i) => (
            <Tab
              key={i}
              ref={el => {
                setRefs(refs => {
                  refs[i] = el;
                  return refs;
                });
              }}
            >
              {'to' in item ? (
                <Link to={item.to} onClick={() => action(item.to)} style={{ height }}>
                  {item.label}
                </Link>
              ) : (
                <button onClick={() => action(item.id)} style={{ height }} type="button">
                  {item.label}
                </button>
              )}
            </Tab>
          ))}
        </List>
      </Inner>

      {renderIndicators && (
        <>
          {lineIndicator && clippedLineIndicator.visible && (
            <LineIndicator
              style={{
                left: clippedLineIndicator.left,
                width: clippedLineIndicator.width
              }}
            />
          )}

          {tabIndicator && clippedTabIndicator.visible && (
            <TabIndicator
              style={{
                left: clippedTabIndicator.left,
                width: clippedTabIndicator.width,
                height,

                top: `calc(50% - ${padding.bottom / 2}px)`,

                ...(variant === 'soft' && {
                  background: theme.colors.gray300
                }),

                ...(variant === 'outline' && {
                  border: `1px solid ${theme.colors.gray400}`
                })
              }}
            />
          )}
        </>
      )}
    </Wrapper>
  );
};

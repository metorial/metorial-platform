import { useIsSSR } from '@looped/hooks';
import React, { useState } from 'react';
import { useWindowSize } from 'react-use';
import { styled } from 'styled-components';
import { theme } from '..';
import { getLink } from '../link';

let Wrapper = styled('div')`
  position: relative;
  width: 100%;
`;

let Inner = styled('div')`
  display: flex;
  padding: 0;
  margin: 0;
  /* gap: PADDINGpx; */
  border-bottom: 1px solid ${theme.colors.gray300};
  /* padding-bottom: 6px; */
  overflow-x: auto;
  white-space: nowrap;
  justify-content: center;
`;

let List = styled('ul')`
  list-style: none;
  display: flex;
  max-width: 100%;
  overflow-x: auto;
  white-space: nowrap;
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
  top: calc(50% - 2px);
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

  let [refs, setRefs] = useState<(HTMLLIElement | null)[]>([]);

  let renderIndicators = false;

  let listOffset = Math.max(
    ((innerRef?.clientWidth ?? 0) - (listRef?.clientWidth ?? 0)) / 2,
    0
  );

  let currentIndex = tabs.findIndex(t => ('to' in t ? t.to == current : t.id == current));
  let indicatorOffset = 0;
  let indicatorWidth = refs[currentIndex]?.clientWidth ?? 0;
  if (refs[currentIndex]) {
    renderIndicators = true;

    indicatorOffset = refs.reduce((acc, ref, i) => {
      if (i < currentIndex && ref) return acc + ref.clientWidth;
      return acc;
    }, 0);
  }

  return (
    <Wrapper>
      <Inner
        ref={setInnerRef}
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
          {lineIndicator && (
            <LineIndicator
              style={{
                left: indicatorOffset + currentIndex * gap + listOffset,
                width: indicatorWidth
              }}
            />
          )}

          {tabIndicator && (
            <TabIndicator
              style={{
                left: indicatorOffset + (currentIndex - 0.5) * gap + listOffset,
                width: indicatorWidth + gap,
                height,

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

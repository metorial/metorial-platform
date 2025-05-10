import React, { useMemo } from 'react';
import { Tabs } from '../tabs';

export let LinkTabs = ({
  current,
  links,

  tabIndicator,
  lineIndicator,
  height,
  gap,
  padding,
  variant,
  margin,
  maxWidth
}: {
  current: string;
  links: { to: string; label: string }[];

  tabIndicator?: boolean;
  lineIndicator?: boolean;
  height?: number;
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
  variant?: 'soft' | 'outline';
  maxWidth?: number | string;
}) => {
  let linkString = useMemo(() => links.map(link => link.to).join(','), [links]);

  let normalizedLinks = useMemo(
    () =>
      links.map(link => ({
        ...link,
        to: new URL(link.to, window.location.origin).pathname
      })),
    [linkString]
  );

  let actualCurrent = useMemo(() => {
    let normalizedCurrent = new URL(current, window.location.origin).pathname;

    let [bestMatch] = normalizedLinks
      .map(link => link.to)
      .filter(link => link == normalizedCurrent || normalizedCurrent.startsWith(`${link}/`))
      .sort((a, b) => b.length - a.length);

    return bestMatch;
  }, [current, normalizedLinks]);

  return (
    <Tabs
      current={actualCurrent}
      tabs={normalizedLinks}
      action={() => {}}
      tabIndicator={tabIndicator}
      lineIndicator={lineIndicator}
      height={height}
      gap={gap}
      margin={margin}
      padding={padding}
      variant={variant}
      maxWidth={maxWidth}
    />
  );
};

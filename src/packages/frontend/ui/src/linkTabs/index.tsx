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
  let actualCurrent = useMemo(() => {
    let [bestMatch] = links
      .map(link => link.to)
      .filter(link => link == current || current.startsWith(`${link}/`))
      .sort((a, b) => b.length - a.length);

    return bestMatch;
  }, [current]);

  return (
    <Tabs
      current={actualCurrent}
      tabs={links}
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

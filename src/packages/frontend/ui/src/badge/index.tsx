import React from 'react';
import { BadgeStyleProps, getBadgeStyles } from './constants';

export let Badge = ({
  children,
  color,
  size,
  style
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
} & BadgeStyleProps) => {
  let styles = getBadgeStyles({ color, size });

  return (
    <span
      style={{
        ...styles,
        ...style,
        display: 'inline-flex',
        alignItems: 'center',
        fontWeight: 600
      }}
    >
      {children}
    </span>
  );
};

import React from 'react';
import { ConnectionBadge, type ConnectionBadgeSize, type ConnectionStatusTone } from './connection';
import { BadgeStyleProps, getBadgeStyles } from './constants';

export * from './connection';
export * from './constants';

type DefaultBadgeProps = {
  variant?: 'default';
  children: React.ReactNode;
  style?: React.CSSProperties;
} & BadgeStyleProps;

type ConnectionVariantBadgeProps = {
  variant: 'connection';
  tone: ConnectionStatusTone;
  size?: ConnectionBadgeSize;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

export type BadgeProps = DefaultBadgeProps | ConnectionVariantBadgeProps;

export let Badge = (props: BadgeProps) => {
  if (props.variant == 'connection') {
    return (
      <ConnectionBadge tone={props.tone} size={props.size} style={props.style}>
        {props.children}
      </ConnectionBadge>
    );
  }

  let { children, color, size, style } = props;
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

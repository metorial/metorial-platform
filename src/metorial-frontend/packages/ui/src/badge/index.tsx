import { Cases } from '@lowerdeck/case';
import React from 'react';
import { theme } from '../theme';
import {
  ConnectionBadge,
  type ConnectionBadgeSize,
  type ConnectionStatusTone
} from './connection';
import { BadgeStyleProps, getBadgeStyles, getIconBadgeStyles } from './constants';

export * from './connection';
export * from './constants';

type DefaultBadgeProps = {
  variant?: 'default';
  icon?: undefined;
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

type IconVariantBadgeProps = {
  variant?: 'icon';
  icon: React.ReactElement<{ size?: number }>;
  children: React.ReactNode;
  style?: React.CSSProperties;
} & BadgeStyleProps;

export type BadgeProps =
  | DefaultBadgeProps
  | ConnectionVariantBadgeProps
  | IconVariantBadgeProps;

export let Badge = (props: BadgeProps) => {
  if (props.variant == 'connection') {
    return (
      <ConnectionBadge tone={props.tone} size={props.size} style={props.style}>
        {props.children}
      </ConnectionBadge>
    );
  }

  if (props.icon) {
    let styles = getIconBadgeStyles({ color: props.color, size: props.size });

    return (
      <span
        style={{
          ...styles.outer,
          ...props.style,
          display: 'inline-flex',
          alignItems: 'center',
          background: theme.colors.gray300,
          gap: '6px'
        }}
      >
        <i
          style={{
            ...styles.iconCircle,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {React.cloneElement(props.icon, { size: styles.iconSize })}
        </i>

        <span style={{ fontWeight: 600 }}>{props.children}</span>
      </span>
    );
  }

  let { children, color, size, style } = props;
  let styles = getBadgeStyles({ color, size });

  if (
    typeof children == 'string' &&
    (children.includes('_') || children.toLowerCase() == children)
  ) {
    children = Cases.toTitleCase(children.replace(/_/g, ' '));
  }

  return (
    <span
      style={{
        ...styles.outer,
        ...style,
        display: 'inline-flex',
        alignItems: 'center',
        background: theme.colors.gray300,
        gap: '6px'
      }}
    >
      <i style={{ ...styles.dot, flexShrink: 0 }} />

      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          fontWeight: 600
        }}
      >
        {children}
      </span>
    </span>
  );
};

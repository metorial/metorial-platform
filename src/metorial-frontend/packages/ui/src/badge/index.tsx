import { Cases } from '@lowerdeck/case';
import React from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';
import { getColorKey } from '../theme/colors';
import {
  ConnectionBadge,
  type ConnectionBadgeSize,
  type ConnectionStatusTone
} from './connection';
import { BadgeStyleProps, getBadgeStyles, getIconBadgeStyles } from './constants';
import { BadgeIndicator } from './indicator';

let indicatorSizes = { '1': 8, '2': 11, '3': 15 };

export * from './connection';
export * from './constants';

type DefaultBadgeProps = {
  variant?: 'default';
  icon?: undefined;
  children: React.ReactNode;
  style?: React.CSSProperties;
  loading?: boolean;
} & BadgeStyleProps;

type ConnectionVariantBadgeProps = {
  variant: 'connection';
  tone: ConnectionStatusTone;
  size?: ConnectionBadgeSize;
  children: React.ReactNode;
  style?: React.CSSProperties;
  loading?: boolean;
};

type IconVariantBadgeProps = {
  variant?: 'icon';
  icon: React.ReactElement<{ size?: number }>;
  children: React.ReactNode;
  style?: React.CSSProperties;
  loading?: boolean;
} & BadgeStyleProps;

export type BadgeProps =
  DefaultBadgeProps | ConnectionVariantBadgeProps | IconVariantBadgeProps;

let BadgeRoot = styled.span`
  transition:
    background-color 220ms ease,
    color 220ms ease,
    border-color 220ms ease;

  i {
    transition:
      background-color 220ms ease,
      color 220ms ease;
  }

  @media (prefers-reduced-motion: reduce) {
    &,
    i {
      transition: none;
    }
  }
`;

export let Badge = (props: BadgeProps) => {
  if (props.variant == 'connection') {
    return (
      <ConnectionBadge
        tone={props.tone}
        size={props.size}
        style={props.style}
        loading={props.loading}
      >
        {props.children}
      </ConnectionBadge>
    );
  }

  if (props.icon) {
    let styles = getIconBadgeStyles({ color: props.color, size: props.size });

    return (
      <BadgeRoot
        aria-busy={props.loading || undefined}
        style={{
          ...styles.outer,
          ...props.style,
          display: 'inline-flex',
          alignItems: 'center',
          background: theme.colors.gray300,
          gap: '6px'
        }}
      >
        <BadgeIndicator
          loading={props.loading}
          size={parseInt(styles.iconCircle.width)}
          color={theme.colors[getColorKey(props.color, '800')]}
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
        </BadgeIndicator>

        <span style={{ fontWeight: 600, color: theme.colors.gray900 }}>{props.children}</span>
      </BadgeRoot>
    );
  }

  let { children, color, size = '2', style, loading } = props;
  let styles = getBadgeStyles({ color, size });

  if (
    typeof children == 'string' &&
    (children.includes('_') || children.toLowerCase() == children)
  ) {
    children = Cases.toTitleCase(children.replace(/_/g, ' '));
  }

  return (
    <BadgeRoot
      aria-busy={loading || undefined}
      style={{
        ...styles.outer,
        ...style,
        display: 'inline-flex',
        alignItems: 'center',
        background: theme.colors.gray300,
        gap: '6px'
      }}
    >
      <BadgeIndicator
        loading={loading}
        size={indicatorSizes[size]}
        color={theme.colors[getColorKey(color, '800')]}
      >
        <i style={{ ...styles.dot, flexShrink: 0 }} />
      </BadgeIndicator>

      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          fontWeight: 600,
          color: theme.colors.gray900
        }}
      >
        {children}
      </span>
    </BadgeRoot>
  );
};

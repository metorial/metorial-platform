import { Badge, type BadgeSize, type ColorType } from '@metorial/ui';
import React from 'react';

export type SecurityLevel = 'unknown' | 'low' | 'moderate' | 'medium' | 'high' | 'critical';

let levelColors: Record<SecurityLevel, ColorType> = {
  unknown: 'gray',
  low: 'green',
  moderate: 'yellow',
  medium: 'yellow',
  high: 'orange',
  critical: 'red'
};

export let getSecurityLevelColor = (level: SecurityLevel) => levelColors[level] ?? 'gray';

export let LevelBadge = ({
  level,
  children,
  size
}: {
  level: SecurityLevel;
  children: React.ReactNode;
  size?: BadgeSize;
}) => (
  <Badge color={getSecurityLevelColor(level)} size={size}>
    {children}
  </Badge>
);

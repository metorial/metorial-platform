import React from 'react';
import { keyframes, styled } from 'styled-components';
import { theme } from '../theme';

export type ConnectionStatusTone = 'connected' | 'available' | 'review';

export type ConnectionBadgeSize = '1' | '2';

export let pulseConnectionDot = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(0, 144, 255, 0.24);
  }

  70% {
    box-shadow: 0 0 0 5px rgba(0, 144, 255, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(0, 144, 255, 0);
  }
`;

export let getConnectionStatusDotColor = (tone: ConnectionStatusTone) => {
  if (tone == 'connected') return theme.colors.blue800;
  if (tone == 'review') return theme.colors.orange800;
  return theme.colors.gray500;
};

let ConnectionBadgeRoot = styled.span<{ $tone: ConnectionStatusTone; $size: ConnectionBadgeSize }>`
  min-width: ${({ $size }) => ($size == '1' ? '0' : '64px')};
  height: ${({ $size }) => ($size == '1' ? '20px' : '24px')};
  padding: ${({ $size }) => ($size == '1' ? '0 7px' : '0 9px')};
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ $size }) => ($size == '1' ? '5px' : '7px')};
  flex-shrink: 0;
  align-self: flex-start;
  border: 1px solid
    ${({ $tone }) =>
      $tone == 'connected'
        ? theme.colors.blue400
        : $tone == 'review'
          ? theme.colors.orange400
          : theme.colors.gray300};
  background: ${({ $tone }) =>
    $tone == 'connected'
      ? theme.colors.blue200
      : $tone == 'review'
        ? theme.colors.orange200
        : theme.colors.gray200};
  color: ${({ $tone }) =>
    $tone == 'connected'
      ? theme.colors.blue900
      : $tone == 'review'
        ? theme.colors.orange900
        : theme.colors.gray700};
  font-size: ${({ $size }) => ($size == '1' ? '10px' : '11px')};
  line-height: 1;
  font-weight: 650;
`;

let StatusPulse = styled.span<{ $size: ConnectionBadgeSize }>`
  width: ${({ $size }) => ($size == '1' ? '6px' : '7px')};
  height: ${({ $size }) => ($size == '1' ? '6px' : '7px')};
  border-radius: 999px;
  background: ${theme.colors.blue900};
  animation: ${pulseConnectionDot} 2.2s ease-out infinite;
`;

let StatusDot = styled.span<{ $tone: ConnectionStatusTone; $size: ConnectionBadgeSize }>`
  width: ${({ $size }) => ($size == '1' ? '6px' : '7px')};
  height: ${({ $size }) => ($size == '1' ? '6px' : '7px')};
  border-radius: 999px;
  background: ${({ $tone }) =>
    $tone == 'connected'
      ? theme.colors.blue900
      : $tone == 'review'
        ? theme.colors.orange900
        : theme.colors.gray600};
`;

export let ConnectionBadge = ({
  children,
  tone,
  size = '2',
  style
}: {
  children: React.ReactNode;
  tone: ConnectionStatusTone;
  size?: ConnectionBadgeSize;
  style?: React.CSSProperties;
}) => (
  <ConnectionBadgeRoot $tone={tone} $size={size} style={style}>
    {children}
    {tone == 'connected' ? (
      <StatusPulse $size={size} />
    ) : (
      <StatusDot $tone={tone} $size={size} />
    )}
  </ConnectionBadgeRoot>
);

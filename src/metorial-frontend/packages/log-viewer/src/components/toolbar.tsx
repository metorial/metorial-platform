import React from 'react';
import styled, { css, keyframes } from 'styled-components';
import type { LogStatus } from '../types';
import { logPalette } from './palette';

let livePulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.4);
  }

  70% {
    box-shadow: 0 0 0 5px rgba(74, 222, 128, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(74, 222, 128, 0);
  }
`;

export let Toolbar = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px 8px 14px;
  border-bottom: 1px solid ${logPalette.border};
  background: ${logPalette.surface};
  color: ${logPalette.muted};
  font-size: 12px;
  font-weight: 500;
`;

export let ToolbarGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  min-width: 0;

  & + & {
    gap: 6px;
  }
`;

export let ToolbarButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid ${logPalette.control};
  border-radius: 6px;
  background: transparent;
  color: ${logPalette.muted};
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;

  svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  &:not(:disabled):hover {
    background: ${logPalette.border};
    color: ${logPalette.text};
  }

  &[aria-pressed='true'] {
    background: ${logPalette.control};
    border-color: ${logPalette.controlActive};
    color: ${logPalette.text};
  }

  &:focus-visible {
    outline: 2px solid ${logPalette.controlActive};
    outline-offset: 1px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

export let ToolbarText = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;

  svg {
    width: 14px;
    height: 14px;
  }
`;

export let WarningText = styled(ToolbarText)`
  color: ${logPalette.yellow};
`;

export let TruncatedTag = styled.span`
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  border: 1px solid rgba(251, 191, 36, 0.35);
  border-radius: 999px;
  color: ${logPalette.yellow};
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
`;

let StatusRoot = styled.span<{ $live: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: ${p => (p.$live ? logPalette.green : logPalette.muted)};
`;

let StatusDot = styled.span<{ $live: boolean }>`
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: ${p => (p.$live ? logPalette.green : logPalette.dim)};

  ${p =>
    p.$live &&
    css`
      animation: ${livePulse} 2.2s ease-out infinite;
    `}
`;

export let StatusChip = ({ status }: { status: LogStatus }) => {
  let live = status == 'open';

  return (
    <StatusRoot $live={live}>
      <StatusDot $live={live} />
      {live ? 'Live' : 'Complete'}
    </StatusRoot>
  );
};

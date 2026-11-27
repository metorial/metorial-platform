import AnsiModule from 'ansi-to-react';
import React, { memo } from 'react';
import styled from 'styled-components';
import {
  formatClockTime,
  hasControlSequences,
  parseTimestamp,
  truncateForDisplay
} from '../lib/text';
import type { LogLine } from '../types';
import {
  ansiColorOverrides,
  GUTTER_PADDING_PX,
  logPalette,
  ROW_HEIGHT,
  TEXT_PADDING_PX,
  TIMESTAMP_COLUMNS,
  TIMESTAMP_PADDING_PX
} from './palette';

let ansiColorCss = ansiColorOverrides
  .map(
    ([rgb, color]) => `
      span[style^='color: rgb(${rgb})'],
      span[style*='; color: rgb(${rgb})'] {
        color: ${color} !important;
      }
    `
  )
  .join('');

let Ansi = ((AnsiModule as unknown as { default?: typeof AnsiModule }).default ??
  AnsiModule) as typeof AnsiModule;

let RowRoot = styled.div`
  display: flex;
  min-height: ${ROW_HEIGHT}px;
  line-height: ${ROW_HEIGHT}px;
  color: ${logPalette.text};
  cursor: default;

  &[data-wrap='false'] {
    height: ${ROW_HEIGHT}px;
    overflow-y: clip;
    white-space: pre;
  }

  &[data-wrap='true'] {
    white-space: pre-wrap;
  }

  &:hover,
  &:hover > [data-gutter] {
    background: ${logPalette.surface};
  }

  &[data-stream='system'] > [data-text] {
    color: ${logPalette.system};
    font-style: italic;
  }
`;

let Gutter = styled.span`
  position: sticky;
  left: 0;
  flex-shrink: 0;
  box-sizing: content-box;
  width: var(--log-gutter-width);
  padding: 0 12px 0 ${GUTTER_PADDING_PX - 12}px;
  text-align: right;
  color: ${logPalette.dim};
  background: ${logPalette.background};
  user-select: none;
`;

let Timestamp = styled.span`
  flex-shrink: 0;
  width: ${TIMESTAMP_COLUMNS}ch;
  padding-right: ${TIMESTAMP_PADDING_PX}px;
  color: ${logPalette.dim};
  user-select: none;
`;

let Text = styled.span`
  flex: 1 0 auto;
  padding-right: ${TEXT_PADDING_PX}px;

  [data-wrap='true'] > & {
    flex: 1 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  code {
    background: unset;
    padding: unset;
    font: inherit;
    color: inherit;
  }

  ${ansiColorCss}
`;

let EdgeRoot = styled.div`
  position: sticky;
  left: 0;
  width: var(--log-viewport-width, 100%);
  height: ${ROW_HEIGHT}px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: ${logPalette.dim};
  font-size: 11px;
  white-space: nowrap;
  user-select: none;
`;

let EdgeAction = styled.button`
  padding: 0;
  border: none;
  background: none;
  color: ${logPalette.muted};
  font: inherit;
  text-decoration: underline;
  cursor: pointer;

  &:hover {
    color: ${logPalette.text};
  }
`;

export let LogRow = memo(
  ({
    line,
    wrap,
    showTimestamps,
    registerRow
  }: {
    line: LogLine;
    wrap: boolean;
    showTimestamps: boolean;
    registerRow: (index: number, element: HTMLDivElement | null) => void;
  }) => {
    let timestamp = parseTimestamp(line.timestamp);
    let text = truncateForDisplay(line.text);

    return (
      <RowRoot
        ref={element => {
          registerRow(line.index, element);
        }}
        data-wrap={wrap}
        data-stream={line.stream}
      >
        <Gutter data-gutter>{line.index + 1}</Gutter>

        {showTimestamps && (
          <Timestamp>{timestamp ? formatClockTime(timestamp) : ''}</Timestamp>
        )}

        <Text data-text>{hasControlSequences(text) ? <Ansi>{text}</Ansi> : text}</Text>
      </RowRoot>
    );
  }
);

export let EdgeRow = ({
  label,
  errorLabel,
  error,
  onRetry
}: {
  label: string;
  errorLabel: string;
  error: Error | null;
  onRetry: () => void;
}) => (
  <EdgeRoot>
    {error ? (
      <>
        <span title={error.message}>{errorLabel}</span>
        <EdgeAction type="button" onClick={onRetry}>
          Retry
        </EdgeAction>
      </>
    ) : (
      <span>{label}</span>
    )}
  </EdgeRoot>
);

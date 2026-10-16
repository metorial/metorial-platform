import { Spinner, useCopy } from '@metorial/ui';
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiFileCopyLine,
  RiRefreshLine,
  RiTextWrap,
  RiTimeLine
} from '@remixicon/react';
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { EdgeRow, LogRow } from './components/logRow';
import {
  GUTTER_PADDING_PX,
  logPalette,
  monoFontFamily,
  PADDING_Y,
  ROW_HEIGHT,
  TEXT_PADDING_PX,
  TIMESTAMP_COLUMNS,
  TIMESTAMP_PADDING_PX
} from './components/palette';
import {
  StatusChip,
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarText,
  TruncatedTag,
  WarningText
} from './components/toolbar';
import { findLinePosition, type LogScrollRequest } from './lib/logWindow';
import {
  createFixedRowLayout,
  createMeasuredRowLayout,
  getVisibleRows
} from './lib/rowLayout';
import { formatLineCount, getDisplayLength, linesToPlainText } from './lib/text';
import type { LogLine, LogSource } from './types';
import { useLogWindow } from './useLogWindow';

let DEFAULT_HEIGHT = 500;
let OVERSCAN_PX = 400;
let EDGE_ROWS = 40;
let PIN_THRESHOLD_PX = 4;
let CHAR_WIDTH_PX = 7.2;

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: 8px;
  border: 1px solid ${logPalette.border};
  background: ${logPalette.background};
  overflow: hidden;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);

  ::selection {
    background-color: ${logPalette.selection};
    color: #000;
  }
`;

let Body = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
`;

let Scroller = styled.div`
  position: absolute;
  inset: 0;
  overflow: auto;
  overflow-anchor: none;
  font-family: ${monoFontFamily};
  font-size: 12px;
  tab-size: 4;
  outline: none;

  &:focus-visible {
    box-shadow: inset 0 0 0 1px ${logPalette.controlActive};
  }
`;

let Spacer = styled.div`
  position: relative;
  min-width: 100%;
  overflow-y: clip;
`;

let Rows = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
`;

let Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px 16px;
  text-align: center;
  color: ${logPalette.dim};
  font-size: 12px;
  pointer-events: none;

  button {
    pointer-events: auto;
  }
`;

let OverlayTitle = styled.div`
  color: ${logPalette.muted};
  font-weight: 600;
`;

let NewLinesPill = styled.button`
  position: absolute;
  right: 16px;
  bottom: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  border-radius: 999px;
  background: ${logPalette.text};
  color: ${logPalette.background};
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);

  svg {
    width: 12px;
    height: 12px;
  }

  &:hover {
    background: #fff;
  }
`;

export interface LogViewerProps {
  source: LogSource;
  height?: number | string;
  pollIntervalMs?: number;
  initialLimit?: number;
  pageSize?: number;
  maxLines?: number;
  toolbarStart?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
  emptyText?: React.ReactNode;
  defaultWrap?: boolean;
  defaultShowTimestamps?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

type ScrollAnchor = { index: number; delta: number };

let clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

let estimateWrappedHeight = (line: LogLine, charsPerRow: number) =>
  ROW_HEIGHT * Math.max(1, Math.ceil(getDisplayLength(line) / charsPerRow));

let formatNewLines = (count: number) =>
  `${count.toLocaleString()} new ${count == 1 ? 'line' : 'lines'}`;

export let LogViewer = ({
  source,
  height = DEFAULT_HEIGHT,
  pollIntervalMs,
  initialLimit,
  pageSize,
  maxLines,
  toolbarStart,
  toolbarEnd,
  emptyText,
  defaultWrap = false,
  defaultShowTimestamps = false,
  className,
  style
}: LogViewerProps) => {
  let { logWindow, state } = useLogWindow({
    source,
    pollIntervalMs,
    initialLimit,
    pageSize,
    maxLines
  });

  let { copy, copied } = useCopy();

  let [wrap, setWrap] = useState(defaultWrap);
  let [showTimestamps, setShowTimestamps] = useState(defaultShowTimestamps);
  let [scrollTop, setScrollTop] = useState(0);
  let [viewport, setViewport] = useState({ width: 0, height: 0 });
  let [measureVersion, setMeasureVersion] = useState(0);

  let scrollerRef = useRef<HTMLDivElement>(null);
  let rowElements = useRef(new Map<number, HTMLDivElement>());
  let heightCache = useRef({ owner: logWindow, key: '', heights: new Map<number, number>() });
  let anchor = useRef<ScrollAnchor | null>(null);
  let appliedScrollRequest = useRef<LogScrollRequest | null>(null);

  let { lines, phase } = state;
  let ready = phase == 'ready';
  let topRows = ready && state.hasBefore ? 1 : 0;
  let bottomRows = ready && !state.atTail ? 1 : 0;
  let lineRowsEnd = topRows + lines.length;

  let gutterColumns = Math.max(3, String(Math.max(state.totalLines, state.end)).length);
  let fixedColumns = gutterColumns + (showTimestamps ? TIMESTAMP_COLUMNS : 0);
  let fixedPx =
    GUTTER_PADDING_PX + TEXT_PADDING_PX + (showTimestamps ? TIMESTAMP_PADDING_PX : 0);
  let charsPerRow = Math.max(
    16,
    Math.floor((viewport.width - fixedPx) / CHAR_WIDTH_PX) - fixedColumns
  );

  let measureKey = `${viewport.width}:${fixedColumns}`;
  if (heightCache.current.owner !== logWindow || heightCache.current.key != measureKey) {
    heightCache.current = { owner: logWindow, key: measureKey, heights: new Map() };
  }

  // Wrapped rows have unknown heights: estimate from the text length, then replace the
  // estimate with the real height once a row has been rendered (see the measuring effect).
  let layout = useMemo(() => {
    let count = lineRowsEnd + bottomRows;
    if (!wrap) return createFixedRowLayout(count, ROW_HEIGHT);

    let measured = heightCache.current.heights;
    let heights = new Array<number>(count).fill(ROW_HEIGHT);

    lines.forEach((line, position) => {
      heights[topRows + position] =
        measured.get(line.index) ?? estimateWrappedHeight(line, charsPerRow);
    });

    return createMeasuredRowLayout(heights);
  }, [
    logWindow,
    lines,
    topRows,
    lineRowsEnd,
    bottomRows,
    wrap,
    charsPerRow,
    measureKey,
    measureVersion
  ]);

  let maxColumns = useMemo(
    () => (wrap ? 0 : lines.reduce((max, line) => Math.max(max, getDisplayLength(line)), 0)),
    [lines, wrap]
  );

  let contentHeight = layout.totalHeight + PADDING_Y * 2;

  let latest = useRef({ state, layout, topRows });
  latest.current = { state, layout, topRows };

  let retry = useCallback(() => void logWindow.retry(), [logWindow]);

  let registerRow = useCallback((index: number, element: HTMLDivElement | null) => {
    if (element) rowElements.current.set(index, element);
    else rowElements.current.delete(index);
  }, []);

  let syncScroll = useCallback(
    (element: HTMLDivElement, updateAnchor: boolean) => {
      let { state, layout, topRows } = latest.current;
      let top = element.scrollTop;
      let viewportHeight = element.clientHeight;

      setScrollTop(top);
      if (state.phase != 'ready') return;

      logWindow.setPinned(element.scrollHeight - top - viewportHeight <= PIN_THRESHOLD_PX);

      let lines = state.lines;
      if (!lines.length) return;

      let lineAt = (y: number) =>
        clamp(layout.rowAt(y - PADDING_Y) - topRows, 0, lines.length - 1);

      let firstLine = lineAt(top);
      let middleLine = lineAt(top + viewportHeight / 2);
      let lastLine = lineAt(top + viewportHeight);

      if (updateAnchor) {
        anchor.current = {
          index: lines[firstLine].index,
          delta: top - PADDING_Y - layout.offsetOf(topRows + firstLine)
        };
      }

      logWindow.setFocus(lines[middleLine].index);

      if (state.hasBefore && firstLine < EDGE_ROWS) void logWindow.loadBefore();
      if (!state.atTail && lastLine >= lines.length - EDGE_ROWS) void logWindow.loadAfter();
    },
    [logWindow]
  );

  useLayoutEffect(() => {
    anchor.current = null;
    appliedScrollRequest.current = null;
  }, [logWindow]);

  useLayoutEffect(() => {
    let element = scrollerRef.current;
    if (!element) return;

    let update = () =>
      setViewport(current =>
        current.width == element.clientWidth && current.height == element.clientHeight
          ? current
          : { width: element.clientWidth, height: element.clientHeight }
      );

    update();
    if (typeof ResizeObserver == 'undefined') return;

    let observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!wrap) return;

    let measured = heightCache.current.heights;
    let changed = false;

    rowElements.current.forEach((element, index) => {
      let rowHeight = element.offsetHeight;
      if (rowHeight <= 0 || measured.get(index) === rowHeight) return;

      measured.set(index, rowHeight);
      changed = true;
    });

    if (changed) setMeasureVersion(version => version + 1);
  });

  // Keeps the reader's place whenever rows above them change (prepends, evictions,
  // measured wrap heights): the first visible line is pinned to the same screen offset.
  useLayoutEffect(() => {
    let element = scrollerRef.current;
    if (!element || !ready) return;

    let maxTop = Math.max(0, contentHeight - element.clientHeight);
    let request = state.scrollRequest;
    let target: number | null = null;
    let keepAnchor = false;

    if (request && request !== appliedScrollRequest.current) {
      appliedScrollRequest.current = request;
      target = request.target == 'top' ? 0 : maxTop;
    } else if (state.pinned && state.atTail) {
      target = maxTop;
    } else if (anchor.current) {
      let position = findLinePosition(lines, anchor.current.index);

      if (position >= 0) {
        target = PADDING_Y + layout.offsetOf(topRows + position) + anchor.current.delta;
        keepAnchor = true;
      }
    }

    if (target !== null) {
      let next = clamp(target, 0, maxTop);
      if (Math.abs(element.scrollTop - next) >= 1) element.scrollTop = next;
    }

    syncScroll(element, !keepAnchor);
  }, [layout, ready, viewport.height, state.scrollRequest, state.pinned, state.atTail]);

  let onScroll = () => {
    if (scrollerRef.current) syncScroll(scrollerRef.current, true);
  };

  let onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key == 'Home') {
      event.preventDefault();
      void logWindow.jumpToStart();
    }

    if (event.key == 'End') {
      event.preventDefault();
      void logWindow.jumpToLatest();
    }
  };

  let { first, last } = getVisibleRows(
    layout,
    scrollTop - PADDING_Y,
    viewport.height,
    OVERSCAN_PX
  );

  let rows: React.ReactNode[] = [];

  for (let row = first; row <= last; row++) {
    if (row < topRows) {
      rows.push(
        <EdgeRow
          key="before"
          label="Loading earlier lines…"
          errorLabel="Couldn't load earlier lines."
          error={state.beforeError}
          onRetry={retry}
        />
      );
    } else if (row >= lineRowsEnd) {
      rows.push(
        <EdgeRow
          key="after"
          label="Loading more lines…"
          errorLabel="Couldn't load more lines."
          error={state.afterError}
          onRetry={retry}
        />
      );
    } else {
      let line = lines[row - topRows];

      rows.push(
        <LogRow
          key={line.index}
          line={line}
          wrap={wrap}
          showTimestamps={showTimestamps}
          registerRow={registerRow}
        />
      );
    }
  }

  let isEmpty = ready && !lines.length && !state.hasBefore && state.atTail;
  let showJumpToLatest = ready && !(state.atTail && state.pinned);
  let showNewLines = ready && state.atTail && !state.pinned && state.newLineCount > 0;

  let copyTitle = lines.length
    ? `Copy lines ${(lines[0].index + 1).toLocaleString()}–${(lines[lines.length - 1].index + 1).toLocaleString()}`
    : undefined;

  let scrollerStyle = {
    '--log-gutter-width': `${gutterColumns}ch`,
    ...(viewport.width ? { '--log-viewport-width': `${viewport.width}px` } : {})
  } as React.CSSProperties;

  return (
    <Wrapper
      className={className}
      style={{ ...style, height: typeof height == 'number' ? `${height}px` : height }}
    >
      <Toolbar>
        <ToolbarGroup>
          {toolbarStart}
          {state.status && <StatusChip status={state.status} />}

          {state.truncated && (
            <TruncatedTag title="This log reached its size limit and was cut off.">
              Truncated
            </TruncatedTag>
          )}

          {ready && <ToolbarText>{formatLineCount(state.totalLines)}</ToolbarText>}

          {state.pollError && (
            <WarningText title={state.pollError.message}>
              <RiErrorWarningLine />
              Reconnecting…
            </WarningText>
          )}
        </ToolbarGroup>

        <ToolbarGroup>
          <ToolbarButton
            type="button"
            aria-pressed={wrap}
            onClick={() => setWrap(value => !value)}
          >
            <RiTextWrap />
            Wrap
          </ToolbarButton>

          <ToolbarButton
            type="button"
            aria-pressed={showTimestamps}
            onClick={() => setShowTimestamps(value => !value)}
          >
            <RiTimeLine />
            Timestamps
          </ToolbarButton>

          <ToolbarButton
            type="button"
            disabled={phase == 'loading'}
            onClick={() => void logWindow.jumpToStart()}
          >
            <RiArrowUpLine />
            Jump to Start
          </ToolbarButton>

          {showJumpToLatest && (
            <ToolbarButton type="button" onClick={() => void logWindow.jumpToLatest()}>
              <RiArrowDownLine />
              Jump to Latest
            </ToolbarButton>
          )}

          <ToolbarButton
            type="button"
            disabled={!lines.length}
            title={copyTitle}
            onClick={() => copy(linesToPlainText(lines))}
          >
            {copied ? <RiCheckLine /> : <RiFileCopyLine />}
            {copied ? 'Copied' : 'Copy'}
          </ToolbarButton>

          {toolbarEnd}
        </ToolbarGroup>
      </Toolbar>

      <Body>
        <Scroller
          ref={scrollerRef}
          tabIndex={0}
          role="region"
          aria-label="Log output"
          style={scrollerStyle}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
        >
          <Spacer
            style={{
              height: contentHeight,
              width: wrap ? undefined : `calc(${maxColumns + fixedColumns}ch + ${fixedPx}px)`
            }}
          >
            <Rows style={{ transform: `translateY(${PADDING_Y + layout.offsetOf(first)}px)` }}>
              {rows}
            </Rows>
          </Spacer>
        </Scroller>

        {phase == 'loading' && (
          <Overlay>
            <Spinner size={16} foreground={logPalette.muted} background={logPalette.control} />
          </Overlay>
        )}

        {phase == 'error' && (
          <Overlay>
            <OverlayTitle>Couldn't load logs.</OverlayTitle>
            {state.error?.message && <span>{state.error.message}</span>}

            <ToolbarButton type="button" onClick={retry}>
              <RiRefreshLine />
              Retry
            </ToolbarButton>
          </Overlay>
        )}

        {isEmpty && (
          <Overlay>
            {emptyText ??
              (state.status == 'open' ? 'Waiting for log output…' : 'No log output.')}
          </Overlay>
        )}

        {showNewLines && (
          <NewLinesPill type="button" onClick={() => void logWindow.jumpToLatest()}>
            <RiArrowDownLine />
            {formatNewLines(state.newLineCount)}
          </NewLinesPill>
        )}
      </Body>

      <link rel="stylesheet" href="https://fonts.metorial.com/jetbrains-mono.css" />
    </Wrapper>
  );
};

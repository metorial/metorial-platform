import { Button, theme } from '@metorial/ui';
import { RiArrowRightSLine } from '@remixicon/react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react';
import styled from 'styled-components';
import { basename, isRootPath, normalizePath } from '../lib/path';
import { flattenTree, type TreeRow } from '../lib/tree';
import type { DirectorySnapshot } from '../state/directoryStore';
import { useElementHeight } from '../state/hooks';
import { rootEntry } from '../state/resolvePath';
import type { FileEntry } from '../types';
import { EntryIcon } from './entryIcon';

let ROW_HEIGHT = 28;
let INDENT = 14;
let BASE_INDENT = 6;
let VIRTUALIZE_THRESHOLD = 300;
let OVERSCAN_ROWS = 10;

let Root = styled.div`
  display: flex;
  flex-direction: column;
  width: 248px;
  flex: none;
  min-height: 0;
  border-right: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};
`;

let TreeList = styled.div`
  flex: 1;
  min-height: 0;
  padding: 6px;
  overflow: auto;
  outline: none;

  &:focus-visible [data-active='true'] {
    box-shadow: inset 0 0 0 1px ${theme.colors.gray600};
  }
`;

let Item = styled.div<{ $indent: number }>`
  display: flex;
  align-items: center;
  gap: 4px;
  height: ${ROW_HEIGHT}px;
  padding: 0 6px 0 ${p => p.$indent}px;
  border-radius: 6px;
  color: ${theme.colors.gray800};
  font-size: 13px;
  cursor: default;
  user-select: none;
  transition: background 0.15s ease;

  &:hover {
    background: ${theme.colors.gray250};
  }

  &[data-current='true'] {
    background: ${theme.colors.gray300};
    color: ${theme.colors.foreground};
    font-weight: 600;
  }
`;

let Chevron = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: ${theme.colors.gray600};
  cursor: pointer;

  &:hover {
    background: ${theme.colors.gray350};
  }

  svg {
    transition: transform 0.15s ease;
  }

  &[data-expanded='true'] svg {
    transform: rotate(90deg);
  }
`;

let ChevronSpace = styled.span`
  flex: none;
  width: 18px;
`;

let Label = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let BadgeSlot = styled.span`
  display: inline-flex;
  flex: none;
`;

let StatusRow = styled.div<{ $indent: number }>`
  display: flex;
  align-items: center;
  gap: 8px;
  height: ${ROW_HEIGHT}px;
  padding: 0 6px 0 ${p => p.$indent}px;
  color: ${theme.colors.gray600};
  font-size: 12px;
`;

let Gap = styled.div`
  flex: none;
`;

let statusText = {
  loading: 'Loading…',
  error: 'Couldn’t load this folder.',
  empty: 'Empty',
  truncated: 'Some items aren’t shown.'
} as const;

let findParentIndex = (rows: TreeRow[], index: number) => {
  let current = rows[index];
  if (current?.kind != 'node') return -1;

  for (let i = index - 1; i >= 0; i--) {
    let candidate = rows[i]!;
    if (candidate.kind == 'node' && candidate.depth < current.depth) return i;
  }

  return -1;
};

export interface FolderTreeProps {
  rootPath: string;
  currentPath: string;
  snapshot: DirectorySnapshot;
  expanded: ReadonlySet<string>;
  showHidden: boolean;
  renderBadge?: (entry: FileEntry) => ReactNode;
  onToggle: (path: string) => void;
  onOpen: (path: string) => void;
  onRetry: (path: string) => void;
}

export let FolderTree = (p: FolderTreeProps) => {
  let treeId = useId();
  let [listRef, listHeight] = useElementHeight<HTMLDivElement>();
  let listElement = useRef<HTMLDivElement | null>(null);
  let [scrollTop, setScrollTop] = useState(0);
  let [activePath, setActivePath] = useState(() => normalizePath(p.currentPath));
  let scrollToActive = useRef(false);

  let setListElement = useCallback(
    (element: HTMLDivElement | null) => {
      listElement.current = element;
      listRef(element);
    },
    [listRef]
  );

  let root = useMemo<FileEntry>(
    () => ({
      ...rootEntry(p.rootPath),
      name: isRootPath(p.rootPath) ? '/' : basename(p.rootPath)
    }),
    [p.rootPath]
  );

  let rows = useMemo(
    () =>
      flattenTree({
        root,
        snapshot: p.snapshot,
        expanded: p.expanded,
        showHidden: p.showHidden
      }),
    [root, p.snapshot, p.expanded, p.showHidden]
  );

  let currentPath = normalizePath(p.currentPath);
  let activeIndex = rows.findIndex(row => row.kind == 'node' && row.path == activePath);
  let virtualized = rows.length > VIRTUALIZE_THRESHOLD;
  let start = virtualized
    ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS)
    : 0;
  let visibleCount = Math.ceil((listHeight || 600) / ROW_HEIGHT) + OVERSCAN_ROWS * 2;
  let end = virtualized ? Math.min(rows.length, start + visibleCount) : rows.length;
  let rowId = (index: number) => `${treeId}-row-${index}`;

  useEffect(() => {
    setActivePath(currentPath);
    scrollToActive.current = true;
  }, [currentPath]);

  useEffect(() => {
    if (!scrollToActive.current || activeIndex < 0) return;
    scrollToActive.current = false;

    let list = listElement.current;
    if (!list) return;

    let top = activeIndex * ROW_HEIGHT;
    let bottom = top + ROW_HEIGHT;

    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight - 12) {
      list.scrollTop = bottom - list.clientHeight + 12;
    }
  }, [activeIndex, rows.length]);

  let moveActive = (index: number) => {
    let direction = index >= activeIndex ? 1 : -1;
    let next = Math.max(0, Math.min(rows.length - 1, index));

    while (rows[next] && rows[next]!.kind != 'node') {
      let candidate = next + direction;
      if (candidate < 0 || candidate >= rows.length) return;
      next = candidate;
    }

    let row = rows[next];
    if (row?.kind != 'node') return;

    scrollToActive.current = true;
    setActivePath(row.path);
  };

  let onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let row = activeIndex >= 0 ? rows[activeIndex] : undefined;
    let node = row?.kind == 'node' ? row : undefined;
    let handled = true;

    if (e.key == 'ArrowDown') moveActive(activeIndex + 1);
    else if (e.key == 'ArrowUp') moveActive(activeIndex < 0 ? 0 : activeIndex - 1);
    else if (e.key == 'Home') moveActive(0);
    else if (e.key == 'End') moveActive(rows.length - 1);
    else if (e.key == 'Enter' && node) p.onOpen(node.path);
    else if (e.key == ' ' && node) p.onOpen(node.path);
    else if (e.key == 'ArrowRight' && node?.expandable) {
      if (!node.expanded) p.onToggle(node.path);
      else moveActive(activeIndex + 1);
    } else if (e.key == 'ArrowLeft' && node) {
      if (node.expandable && node.expanded) p.onToggle(node.path);
      else {
        let parentIndex = findParentIndex(rows, activeIndex);
        if (parentIndex >= 0) moveActive(parentIndex);
      }
    } else handled = false;

    if (handled) e.preventDefault();
  };

  let renderRow = (row: TreeRow, index: number) => {
    let indent = BASE_INDENT + row.depth * INDENT;

    if (row.kind == 'status') {
      return (
        <StatusRow key={row.key} role="none" $indent={indent + 22}>
          {statusText[row.status]}
          {row.status == 'error' ? (
            <Button
              type="button"
              size="1"
              variant="outline"
              onClick={() => p.onRetry(row.path)}
            >
              Retry
            </Button>
          ) : null}
        </StatusRow>
      );
    }

    let badge = p.renderBadge?.(row.entry);

    return (
      <Item
        key={row.key}
        id={rowId(index)}
        role="treeitem"
        aria-level={row.depth + 1}
        aria-expanded={row.expandable ? row.expanded : undefined}
        aria-selected={row.path == currentPath}
        data-current={row.path == currentPath}
        data-active={index == activeIndex}
        $indent={indent}
        onClick={() => {
          setActivePath(row.path);
          p.onOpen(row.path);
        }}
      >
        {row.expandable ? (
          <Chevron
            type="button"
            tabIndex={-1}
            aria-label={
              row.expanded ? `Collapse ${row.entry.name}` : `Expand ${row.entry.name}`
            }
            data-expanded={row.expanded}
            onClick={e => {
              e.stopPropagation();
              p.onToggle(row.path);
            }}
          >
            <RiArrowRightSLine size={14} />
          </Chevron>
        ) : (
          <ChevronSpace />
        )}

        <EntryIcon entry={row.entry} open={row.expanded} />
        <Label title={row.entry.name}>{row.entry.name}</Label>
        {badge ? <BadgeSlot>{badge}</BadgeSlot> : null}
      </Item>
    );
  };

  return (
    <Root>
      <TreeList
        role="tree"
        aria-label="Folders"
        aria-activedescendant={activeIndex >= 0 ? rowId(activeIndex) : undefined}
        tabIndex={0}
        ref={setListElement}
        onKeyDown={onKeyDown}
        onScroll={virtualized ? e => setScrollTop(e.currentTarget.scrollTop) : undefined}
      >
        {virtualized ? <Gap style={{ height: start * ROW_HEIGHT }} /> : null}
        {rows.slice(start, end).map((row, offset) => renderRow(row, start + offset))}
        {virtualized ? <Gap style={{ height: (rows.length - end) * ROW_HEIGHT }} /> : null}
      </TreeList>
    </Root>
  );
};

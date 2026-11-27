import { formatFileSize } from '@metorial/file-upload';
import {
  Button,
  ContextMenu,
  Menu,
  RenderDate,
  theme,
  type ContextMenuItem,
  type MenuItem
} from '@metorial/ui';
import { RiArrowDownLine, RiArrowUpLine, RiMore2Line } from '@remixicon/react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode
} from 'react';
import styled from 'styled-components';
import type { EntryAction, EntryActionItem } from '../lib/actions';
import { formatMode } from '../lib/format';
import { normalizePath } from '../lib/path';
import { isDirectoryLike, type FileSort, type FileSortKey } from '../lib/sort';
import { useElementHeight } from '../state/hooks';
import type { FileEntry } from '../types';
import { EntryIcon } from './entryIcon';

let ROW_HEIGHT = 36;
let VIRTUALIZE_THRESHOLD = 200;
let OVERSCAN_ROWS = 12;
let TYPEAHEAD_RESET_MS = 700;

export type ListingAction = EntryAction;

let Root = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
`;

let Grid = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  outline: none;

  &:focus-visible [data-selected='true'] {
    box-shadow: inset 0 0 0 1px ${theme.colors.gray600};
  }
`;

let rowColumns = (showPermissions: boolean) =>
  showPermissions ? 'minmax(0, 1fr) 90px 210px 110px 40px' : 'minmax(0, 1fr) 90px 210px 40px';

let HeaderRow = styled.div<{ $columns: string }>`
  display: grid;
  grid-template-columns: ${p => p.$columns};
  align-items: center;
  flex: none;
  height: 34px;
  padding: 0 8px;
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let HeaderCell = styled.div<{ $align?: 'right' }>`
  display: flex;
  justify-content: ${p => (p.$align == 'right' ? 'flex-end' : 'flex-start')};
  min-width: 0;
  padding: 0 6px;
`;

let SortButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 6px;
  margin: 0 -6px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: ${theme.colors.gray700};
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover,
  &:focus-visible {
    background: ${theme.colors.gray300};
    outline: none;
  }
`;

let HeaderLabel = styled.span`
  color: ${theme.colors.gray700};
  font-size: 12px;
  font-weight: 600;
`;

let Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 8px 8px;
`;

let Row = styled.div<{ $columns: string }>`
  display: grid;
  grid-template-columns: ${p => p.$columns};
  align-items: center;
  height: ${ROW_HEIGHT}px;
  border-radius: 6px;
  color: ${theme.colors.foreground};
  font-size: 13px;
  cursor: default;
  user-select: none;
  transition: background 0.15s ease;

  &:hover {
    background: ${theme.colors.gray200};
  }

  &[data-selected='true'] {
    background: ${theme.colors.gray300};
  }

  &[data-drop-target='true'] {
    background: color-mix(in srgb, ${theme.colors.blue800} 14%, transparent);
  }
`;

let Cell = styled.div<{ $align?: 'right'; $muted?: boolean; $mono?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${p => (p.$align == 'right' ? 'flex-end' : 'flex-start')};
  gap: 8px;
  min-width: 0;
  padding: 0 6px;
  color: ${p => (p.$muted ? theme.colors.gray700 : 'inherit')};
  font-size: ${p => (p.$mono ? '12px' : 'inherit')};
  font-family: ${p =>
    p.$mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit'};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

let ModifiedCell = styled(Cell)`
  overflow: hidden;

  > * {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

let Name = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
`;

let Target = styled.span`
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  color: ${theme.colors.gray600};
  text-overflow: ellipsis;
`;

let BadgeSlot = styled.span`
  display: inline-flex;
  flex: none;
`;

let Spacer = styled.div`
  flex: none;
`;

let DropOverlay = styled.div`
  position: absolute;
  inset: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed ${theme.colors.blue800};
  border-radius: 10px;
  background: color-mix(in srgb, ${theme.colors.blue800} 8%, ${theme.colors.background});
  color: ${theme.colors.gray900};
  font-size: 13px;
  font-weight: 500;
  pointer-events: none;
  z-index: 2;
`;

let toMenuItems = (
  actions: EntryActionItem[],
  run: (action: ListingAction) => void
): MenuItem[] =>
  actions.map(item =>
    'action' in item
      ? {
          id: item.action,
          label: item.label,
          disabled: item.disabled,
          onClick: () => run(item.action)
        }
      : { type: 'separator' }
  );

let toContextItems = (actions: EntryActionItem[]): ContextMenuItem[] =>
  actions.map(item =>
    'action' in item
      ? { id: item.action, label: item.label, disabled: item.disabled }
      : { type: 'separator' }
  );

let dragHasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

export let collectDroppedFiles = (dataTransfer: DataTransfer) => {
  let items = Array.from(dataTransfer.items ?? []);
  let files: File[] = [];
  let skippedFolders = 0;

  if (items.length) {
    for (let item of items) {
      if (item.kind != 'file') continue;

      let entry = item.webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        skippedFolders++;
        continue;
      }

      let file = item.getAsFile();
      if (file) files.push(file);
    }

    return { files, skippedFolders };
  }

  return { files: Array.from(dataTransfer.files), skippedFolders };
};

let SortHeader = (p: {
  label: string;
  sortKey: FileSortKey;
  sort: FileSort;
  align?: 'right';
  onSortChange: (key: FileSortKey) => void;
}) => {
  let active = p.sort.key == p.sortKey;

  return (
    <HeaderCell
      role="columnheader"
      $align={p.align}
      aria-sort={active ? (p.sort.direction == 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <SortButton type="button" onClick={() => p.onSortChange(p.sortKey)}>
        {p.label}
        {active ? (
          p.sort.direction == 'asc' ? (
            <RiArrowUpLine size={12} />
          ) : (
            <RiArrowDownLine size={12} />
          )
        ) : null}
      </SortButton>
    </HeaderCell>
  );
};

export interface ListingProps {
  entries: FileEntry[];
  sort: FileSort;
  selectedPath: string | null;
  showPermissions: boolean;
  canUpload: boolean;
  currentPath: string;
  emptyState?: ReactNode;
  notice?: ReactNode;
  getActions: (entry: FileEntry) => EntryActionItem[];
  renderBadge?: (entry: FileEntry) => ReactNode;
  onSortChange: (key: FileSortKey) => void;
  onSelect: (path: string | null) => void;
  onAction: (action: ListingAction, entry: FileEntry) => void;
  onNavigateUp: () => void;
  onFilesDropped: (files: File[], directory: string, skippedFolders: number) => void;
}

export let Listing = (p: ListingProps) => {
  let gridId = useId();
  let columns = rowColumns(p.showPermissions);
  let [bodyRef, bodyHeight] = useElementHeight<HTMLDivElement>();
  let bodyElement = useRef<HTMLDivElement | null>(null);
  let [scrollTop, setScrollTop] = useState(0);
  let [dropTarget, setDropTarget] = useState<string | null>(null);
  let typeahead = useRef({ buffer: '', timer: 0 as ReturnType<typeof setTimeout> | 0 });
  let scrollToSelection = useRef(false);

  let setBodyElement = useCallback(
    (element: HTMLDivElement | null) => {
      bodyElement.current = element;
      bodyRef(element);
    },
    [bodyRef]
  );

  let selectedIndex = useMemo(
    () =>
      p.selectedPath == null
        ? -1
        : p.entries.findIndex(entry => normalizePath(entry.path) == p.selectedPath),
    [p.entries, p.selectedPath]
  );

  let virtualized = p.entries.length > VIRTUALIZE_THRESHOLD;
  let start = virtualized
    ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS)
    : 0;
  let visibleCount = Math.ceil((bodyHeight || 600) / ROW_HEIGHT) + OVERSCAN_ROWS * 2;
  let end = virtualized ? Math.min(p.entries.length, start + visibleCount) : p.entries.length;
  let rowId = (index: number) => `${gridId}-row-${index}`;

  useEffect(() => {
    if (!scrollToSelection.current || selectedIndex < 0) return;
    scrollToSelection.current = false;

    let body = bodyElement.current;
    if (!body) return;

    let top = selectedIndex * ROW_HEIGHT;
    let bottom = top + ROW_HEIGHT;
    let viewTop = body.scrollTop;
    let viewBottom = viewTop + body.clientHeight - 12;

    if (top < viewTop) body.scrollTop = top;
    else if (bottom > viewBottom) body.scrollTop = bottom - body.clientHeight + 12;
  }, [selectedIndex]);

  let selectIndex = (index: number) => {
    let entry = p.entries[Math.max(0, Math.min(p.entries.length - 1, index))];
    if (!entry) return;

    scrollToSelection.current = true;
    p.onSelect(normalizePath(entry.path));
  };

  let runTypeahead = (char: string) => {
    let state = typeahead.current;
    if (state.timer) clearTimeout(state.timer);

    state.buffer += char.toLowerCase();
    state.timer = setTimeout(() => (state.buffer = ''), TYPEAHEAD_RESET_MS);

    let repeated = state.buffer.split('').every(c => c == state.buffer[0]);
    let query = repeated ? state.buffer[0]! : state.buffer;
    let offset = repeated ? selectedIndex + 1 : Math.max(selectedIndex, 0);

    for (let i = 0; i < p.entries.length; i++) {
      let index = (offset + i) % p.entries.length;

      if (p.entries[index]!.name.toLowerCase().startsWith(query)) {
        selectIndex(index);
        return;
      }
    }
  };

  let onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target != e.currentTarget) return;

    let selected = selectedIndex >= 0 ? p.entries[selectedIndex] : undefined;
    let pageSize = Math.max(1, Math.floor((bodyHeight || 400) / ROW_HEIGHT) - 1);

    let handled = true;

    if (e.key == 'ArrowDown') selectIndex(selectedIndex + 1);
    else if (e.key == 'ArrowUp' && e.altKey) p.onNavigateUp();
    else if (e.key == 'ArrowUp') selectIndex(selectedIndex < 0 ? 0 : selectedIndex - 1);
    else if (e.key == 'Home') selectIndex(0);
    else if (e.key == 'End') selectIndex(p.entries.length - 1);
    else if (e.key == 'PageDown') selectIndex(selectedIndex + pageSize);
    else if (e.key == 'PageUp') selectIndex(selectedIndex - pageSize);
    else if (e.key == 'Enter' && selected) p.onAction('open', selected);
    else if (e.key == 'Backspace' && (e.metaKey || e.ctrlKey) && selected) {
      p.onAction('delete', selected);
    } else if (e.key == 'Backspace') p.onNavigateUp();
    else if (e.key == 'Delete' && selected) p.onAction('delete', selected);
    else if (e.key == 'F2' && selected) p.onAction('rename', selected);
    else if (e.key == 'Escape' && selected) p.onSelect(null);
    else if (e.key.length == 1 && !e.metaKey && !e.ctrlKey && !e.altKey && e.key != ' ') {
      runTypeahead(e.key);
    } else handled = false;

    if (handled) e.preventDefault();
  };

  let resolveDropDirectory = (e: DragEvent) => {
    let row = (e.target as Element | null)?.closest?.('[data-drop-dir]');
    return row?.getAttribute('data-drop-dir') ?? '';
  };

  let rows = p.entries.slice(start, end).map((entry, offset) => {
    let index = start + offset;
    let path = normalizePath(entry.path);
    let directory = isDirectoryLike(entry);
    let selected = index == selectedIndex;
    let badge = p.renderBadge?.(entry);
    let actions = p.getActions(entry);
    let menuItems = toMenuItems(actions, action => p.onAction(action, entry));
    let contextItems = toContextItems(actions);

    return (
      <ContextMenu
        key={path}
        label={`Actions for ${entry.name}`}
        items={contextItems}
        onItemClick={id => p.onAction(id as ListingAction, entry)}
      >
        <Row
          role="row"
          id={rowId(index)}
          aria-rowindex={index + 2}
          aria-selected={selected}
          data-selected={selected}
          data-drop-dir={directory && p.canUpload ? path : undefined}
          data-drop-target={dropTarget == path}
          $columns={columns}
          onMouseDown={() => p.onSelect(path)}
          onContextMenu={() => p.onSelect(path)}
          onDoubleClick={() => p.onAction('open', entry)}
        >
          <Cell role="gridcell">
            <EntryIcon entry={entry} />
            <Name title={entry.name}>{entry.name}</Name>
            {entry.type == 'symlink' && entry.target ? (
              <Target title={entry.target}>→ {entry.target}</Target>
            ) : null}
            {badge ? <BadgeSlot>{badge}</BadgeSlot> : null}
          </Cell>

          <Cell role="gridcell" $align="right" $muted>
            {directory ? '—' : formatFileSize(entry.size)}
          </Cell>

          <ModifiedCell role="gridcell" $muted>
            {entry.modifiedAt ? <RenderDate date={entry.modifiedAt} /> : '—'}
          </ModifiedCell>

          {p.showPermissions ? (
            <Cell role="gridcell" $muted $mono>
              {formatMode(entry.mode, entry.type) ?? '—'}
            </Cell>
          ) : null}

          <Cell
            role="gridcell"
            $align="right"
            onMouseDown={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
          >
            {menuItems.length ? (
              <Menu items={menuItems} label={`Actions for ${entry.name}`}>
                <Button
                  type="button"
                  size="1"
                  variant="ghost"
                  tabIndex={-1}
                  aria-label={`Actions for ${entry.name}`}
                  iconLeft={<RiMore2Line />}
                />
              </Menu>
            ) : null}
          </Cell>
        </Row>
      </ContextMenu>
    );
  });

  let showOverlay = dropTarget == '' && p.canUpload;

  return (
    <Root
      onDragEnter={e => {
        if (!p.canUpload || !dragHasFiles(e)) return;

        e.preventDefault();
        setDropTarget(resolveDropDirectory(e));
      }}
      onDragOver={e => {
        if (!p.canUpload || !dragHasFiles(e)) return;

        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDropTarget(resolveDropDirectory(e));
      }}
      onDragLeave={e => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setDropTarget(null);
      }}
      onDrop={e => {
        if (!p.canUpload || !dragHasFiles(e)) return;

        e.preventDefault();

        let directory = resolveDropDirectory(e) || p.currentPath;
        let { files, skippedFolders } = collectDroppedFiles(e.dataTransfer);

        setDropTarget(null);
        p.onFilesDropped(files, directory, skippedFolders);
      }}
    >
      {p.notice}

      <Grid
        role="grid"
        aria-label="Files"
        aria-rowcount={p.entries.length + 1}
        aria-activedescendant={selectedIndex >= 0 ? rowId(selectedIndex) : undefined}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <HeaderRow role="row" aria-rowindex={1} $columns={columns}>
          <SortHeader
            label="Name"
            sortKey="name"
            sort={p.sort}
            onSortChange={p.onSortChange}
          />
          <SortHeader
            label="Size"
            sortKey="size"
            align="right"
            sort={p.sort}
            onSortChange={p.onSortChange}
          />
          <SortHeader
            label="Modified"
            sortKey="modified"
            sort={p.sort}
            onSortChange={p.onSortChange}
          />
          {p.showPermissions ? (
            <HeaderCell role="columnheader">
              <HeaderLabel>Permissions</HeaderLabel>
            </HeaderCell>
          ) : null}
          <HeaderCell role="columnheader" aria-label="Actions" />
        </HeaderRow>

        {p.entries.length ? (
          <Body
            role="rowgroup"
            ref={setBodyElement}
            onScroll={virtualized ? e => setScrollTop(e.currentTarget.scrollTop) : undefined}
          >
            {virtualized ? <Spacer style={{ height: start * ROW_HEIGHT }} /> : null}
            {rows}
            {virtualized ? (
              <Spacer style={{ height: (p.entries.length - end) * ROW_HEIGHT }} />
            ) : null}
          </Body>
        ) : (
          p.emptyState
        )}
      </Grid>

      {showOverlay ? <DropOverlay>Drop files to upload to {p.currentPath}</DropOverlay> : null}
    </Root>
  );
};

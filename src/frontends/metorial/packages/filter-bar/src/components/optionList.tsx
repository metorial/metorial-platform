import { Checkbox, Input, Spinner, theme } from '@metorial/ui';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { styled } from 'styled-components';

export type OptionListItem = {
  id: string;
  label: string;
  count?: number;
};

let ROW_HEIGHT = 34;
let OVERSCAN = 6;

let SearchRow = styled('div')`
  padding: 10px 10px 6px;
`;

let Viewport = styled('div')`
  position: relative;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 4px 6px;
`;

let Row = styled('div')`
  position: absolute;
  left: 4px;
  right: 4px;
  height: ${ROW_HEIGHT}px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  border-radius: 7px;
  cursor: pointer;
  user-select: none;
  transition: background 0.12s ease;

  &:hover {
    background: ${theme.colors.gray200};
  }

  & > div:first-child {
    flex: 1;
    min-width: 0;
  }

  label {
    min-width: 0;
  }

  label span {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
    color: ${theme.colors.gray900};
  }
`;

let Count = styled('span')`
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: ${theme.colors.gray600};
`;

let Divider = styled('div')`
  position: absolute;
  left: 12px;
  right: 12px;
  height: 1px;
  background: ${theme.colors.gray300};
`;

let Status = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 72px;
  padding: 12px;
  font-size: 13px;
  color: ${theme.colors.gray600};
  text-align: center;
`;

export let OptionList = ({
  items,
  pinnedItems = [],
  selected,
  onToggle,
  search,
  onSearch,
  searchPlaceholder,
  showSearch = true,
  isLoading,
  empty,
  maxHeight = 300,
  autoFocus = true
}: {
  items: OptionListItem[];
  pinnedItems?: OptionListItem[];
  selected: string[];
  onToggle: (id: string, checked: boolean) => void;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  isLoading?: boolean;
  empty?: string;
  maxHeight?: number;
  autoFocus?: boolean;
}) => {
  let viewportRef = useRef<HTMLDivElement>(null);
  let [scrollTop, setScrollTop] = useState(0);

  let rows = useMemo(() => {
    let pinnedIds = new Set(pinnedItems.map(item => item.id));
    let rest = items.filter(item => !pinnedIds.has(item.id));
    return { pinned: pinnedItems, rest };
  }, [items, pinnedItems]);

  let total = rows.pinned.length + rows.rest.length;
  let dividerHeight = rows.pinned.length && rows.rest.length ? 9 : 0;
  let contentHeight = total * ROW_HEIGHT + dividerHeight;
  let viewportHeight = Math.min(maxHeight, contentHeight + (showSearch ? 6 : 12));

  useLayoutEffect(() => {
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [search]);

  let rowTop = (index: number) =>
    index * ROW_HEIGHT + (index >= rows.pinned.length ? dividerHeight : 0);

  let first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  let last = Math.min(total, Math.ceil((scrollTop + maxHeight) / ROW_HEIGHT) + OVERSCAN);

  let visible: { item: OptionListItem; index: number }[] = [];
  for (let index = first; index < last; index++) {
    let item =
      index < rows.pinned.length ? rows.pinned[index] : rows.rest[index - rows.pinned.length];
    if (item) visible.push({ item, index });
  }

  return (
    <>
      {showSearch && (
        <SearchRow>
          <Input
            label="Search options"
            hideLabel
            size="2"
            autoFocus={autoFocus}
            placeholder={searchPlaceholder ?? 'Search...'}
            value={search}
            onInput={onSearch}
          />
        </SearchRow>
      )}

      {isLoading && total == 0 ? (
        <Status>
          <Spinner size={16} />
        </Status>
      ) : total == 0 ? (
        <Status>{empty ?? 'No results found.'}</Status>
      ) : (
        <Viewport
          ref={viewportRef}
          style={{ height: viewportHeight, paddingTop: showSearch ? 0 : 6 }}
          onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
        >
          <div style={{ height: contentHeight, position: 'relative' }}>
            {dividerHeight > 0 && (
              <Divider style={{ top: rows.pinned.length * ROW_HEIGHT + 4 }} />
            )}

            {visible.map(({ item, index }) => {
              let checked = selected.includes(item.id);

              return (
                <Row
                  key={item.id}
                  style={{ top: rowTop(index) }}
                  onClick={e => {
                    if ((e.target as Element).closest('label, button')) return;
                    onToggle(item.id, !checked);
                  }}
                >
                  <Checkbox
                    label={item.label}
                    checked={checked}
                    onCheckedChange={next => onToggle(item.id, next)}
                  />

                  {typeof item.count == 'number' && (
                    <Count>{item.count.toLocaleString()}</Count>
                  )}
                </Row>
              );
            })}
          </div>
        </Viewport>
      )}
    </>
  );
};

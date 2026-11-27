import { Spinner, theme } from '@metorial/ui';
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiCheckLine,
  RiCornerDownLeftLine,
  RiDeleteBack2Line,
  RiFilter3Line
} from '@remixicon/react';
import React, { useEffect, useRef } from 'react';
import { styled } from 'styled-components';
import type { ListFilter } from '../model/state';
import type { TableFilter, TableFilterPayloadMap } from '../model/tableFilter';
import { useListFilterOptions } from './listOptions';
import type { OptionListItem } from './optionList';

export type FilterSuggestion = {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
};

export type FilterSuggestionGroup = {
  id: string;
  label: string;
  items: FilterSuggestion[];
  isLoading?: boolean;
};

export type BarOption =
  | { kind: 'suggestion'; key: string; group: string; suggestion: FilterSuggestion }
  | { kind: 'filter'; key: string; group: string; filter: TableFilter<any> }
  | {
      kind: 'value';
      key: string;
      group: string;
      filter: ListFilter;
      item: OptionListItem;
      selected: boolean;
      showFilterLabel?: boolean;
    }
  | { kind: 'text'; key: string; group: string; filter: TableFilter<any>; value: string };

export type AsyncValueOptions = {
  items: OptionListItem[];
  isLoading: boolean;
  empty?: string;
};

export let ListValueSource = ({
  filter,
  search,
  filters,
  selected,
  onChange
}: {
  filter: ListFilter;
  search: string;
  filters: TableFilterPayloadMap;
  selected: string[];
  onChange: (options: AsyncValueOptions) => void;
}) => {
  let options = useListFilterOptions(filter, search, filters, selected);
  let lastKey = useRef('');

  let pinnedIds = new Set(options.pinnedItems.map(item => item.id));
  let items = [...options.pinnedItems, ...options.items.filter(item => !pinnedIds.has(item.id))];
  let key = JSON.stringify([items, options.isLoading, options.empty]);

  useEffect(() => {
    if (key == lastKey.current) return;
    lastKey.current = key;
    onChange({ items, isLoading: options.isLoading, empty: options.empty });
  }, [key]);

  return null;
};

let List = styled('div')`
  padding: 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
  max-height: 360px;
`;

let GroupLabel = styled('div')`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: ${theme.colors.gray600};
`;

let Row = styled('div')<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  padding: 0 8px;
  border-radius: 8px;
  cursor: pointer;
  background: ${p => (p.$active ? theme.colors.blue250 : 'transparent')};
  color: ${theme.colors.foreground};
  font-size: 13px;
`;

let RowIcon = styled('span')`
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: ${theme.colors.gray700};
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

let RowLabel = styled('span')`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;

  mark {
    background: none;
    color: inherit;
    font-weight: 700;
  }
`;

let RowMeta = styled('span')`
  flex-shrink: 0;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: ${theme.colors.gray600};
`;

let Check = styled(RiCheckLine)`
  flex-shrink: 0;
  color: ${theme.colors.blue900};
`;

let Status = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 8px;
  font-size: 13px;
  color: ${theme.colors.gray600};
`;

let Footer = styled('footer')`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
  padding: 8px 12px;
  border-top: 1px solid ${theme.colors.gray300};
  font-size: 12px;
  color: ${theme.colors.gray600};

  span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
`;

let Highlight = ({ text, query }: { text: string; query: string }) => {
  let q = query.trim();
  let index = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (index == -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + q.length)}</mark>
      {text.slice(index + q.length)}
    </>
  );
};

export let optionDomId = (baseId: string, index: number) => `${baseId}-option-${index}`;

let OptionRow = ({
  option,
  query,
  active,
  id,
  onSelect,
  onHover
}: {
  option: BarOption;
  query: string;
  active: boolean;
  id: string;
  onSelect: () => void;
  onHover: () => void;
}) => {
  let ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  let content: React.ReactNode;

  if (option.kind == 'suggestion') {
    let { suggestion } = option;
    content = (
      <>
        {suggestion.icon && <RowIcon>{suggestion.icon}</RowIcon>}
        <RowLabel>
          <Highlight text={suggestion.label} query={query} />
        </RowLabel>
        {suggestion.description && <RowMeta>{suggestion.description}</RowMeta>}
      </>
    );
  } else if (option.kind == 'filter') {
    content = (
      <>
        <RowIcon>
          <RiFilter3Line size={16} />
        </RowIcon>
        <RowLabel>
          <Highlight text={option.filter.label} query={query} />
        </RowLabel>
      </>
    );
  } else if (option.kind == 'value') {
    content = (
      <>
        <RowLabel>
          <Highlight text={option.item.label} query={query} />
        </RowLabel>
        {option.showFilterLabel && <RowMeta>{option.filter.label}</RowMeta>}
        {typeof option.item.count == 'number' && (
          <RowMeta>{option.item.count.toLocaleString()}</RowMeta>
        )}
        {option.selected && <Check size={16} />}
      </>
    );
  } else {
    content = (
      <>
        <RowIcon>
          <RiFilter3Line size={16} />
        </RowIcon>
        <RowLabel>
          {option.filter.label} is “{option.value}”
        </RowLabel>
      </>
    );
  }

  return (
    <Row
      ref={ref}
      id={id}
      role="option"
      aria-selected={active}
      $active={active}
      onMouseDown={e => e.preventDefault()}
      onMouseMove={() => !active && onHover()}
      onClick={onSelect}
    >
      {content}
    </Row>
  );
};

export let SuggestionList = ({
  listId,
  options,
  query,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  loadingGroups,
  emptyMessage
}: {
  listId: string;
  options: BarOption[];
  query: string;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (option: BarOption) => void;
  loadingGroups: string[];
  emptyMessage?: string;
}) => {
  let groups: { label: string; entries: { option: BarOption; index: number }[] }[] = [];

  options.forEach((option, index) => {
    let group = groups.find(g => g.label == option.group);
    if (!group) groups.push((group = { label: option.group, entries: [] }));
    group.entries.push({ option, index });
  });

  for (let label of loadingGroups) {
    if (!groups.some(g => g.label == label)) groups.push({ label, entries: [] });
  }

  return (
    <>
      <List id={listId} role="listbox" aria-label="Suggestions">
        {groups.map(group => (
          <div key={group.label} role="group" aria-label={group.label}>
            <GroupLabel>
              {group.label}
              {loadingGroups.includes(group.label) && <Spinner size={10} />}
            </GroupLabel>

            {group.entries.map(({ option, index }) => (
              <OptionRow
                key={option.key}
                id={optionDomId(listId, index)}
                option={option}
                query={query}
                active={index == activeIndex}
                onHover={() => onActiveIndexChange(index)}
                onSelect={() => onSelect(option)}
              />
            ))}
          </div>
        ))}

        {groups.length == 0 && <Status>{emptyMessage ?? 'No suggestions'}</Status>}
      </List>

      <Footer>
        <span>
          <RiArrowUpLine size={13} />
          <RiArrowDownLine size={13} /> to move
        </span>
        <span>
          <RiCornerDownLeftLine size={13} /> to apply
        </span>
        <span>
          <RiDeleteBack2Line size={13} /> removes the last filter
        </span>
      </Footer>
    </>
  );
};

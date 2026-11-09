import { Button, theme } from '@metorial/ui';
import { RiArrowDownSLine } from '@remixicon/react';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { css, styled } from 'styled-components';
import {
  type FilterStateTuple,
  getHighlightLabel,
  getListValue,
  type ListFilter,
  removeFilterState,
  toggleListValue
} from '../model/state';
import type { PillSelections } from '../model/pillSelections';
import { getFilterPayload, type TableFilterPayloadMap } from '../model/tableFilter';
import { useListFilterOptions } from './listOptions';
import { OptionList, type OptionListItem } from './optionList';
import { FilterPopover } from './popover';

let PREVIEW_LIMIT = 30;
let GAP = 8;

let Row = styled('div')`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  width: 100%;
`;

let RowLabel = styled('span')`
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 500;
  color: ${theme.colors.gray650};
`;

let Track = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${GAP}px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
`;

let Measure = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  gap: ${GAP}px;
  visibility: hidden;
  pointer-events: none;
  white-space: nowrap;
`;

let pillBase = css`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 4px 0 12px;
  border: none;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
`;

let Pill = styled('button')<{ $active: boolean; $hasCount: boolean }>`
  ${pillBase};
  padding-right: ${p => (p.$hasCount ? '4px' : '12px')};
  background: ${p => (p.$active ? theme.colors.gray900 : theme.colors.gray300)};
  color: ${p => (p.$active ? theme.colors.background : theme.colors.gray800)};

  &:hover {
    background: ${p => (p.$active ? theme.colors.gray800 : theme.colors.gray350)};
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.blue800};
    outline-offset: 1px;
  }
`;

let PillCount = styled('span')<{ $active: boolean }>`
  min-width: 22px;
  height: 20px;
  padding: 0 7px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  background: ${p => (p.$active ? theme.colors.gray750 : theme.colors.gray200)};
  color: ${p => (p.$active ? theme.colors.background : theme.colors.gray650)};
`;

let MoreButton = styled('button')`
  ${pillBase};
  padding: 0 8px 0 12px;
  gap: 2px;
  background: transparent;
  color: ${theme.colors.gray700};
  box-shadow: inset 0 0 0 1px ${theme.colors.gray400};

  &:hover,
  &[data-state='open'] {
    background: ${theme.colors.gray200};
  }
`;

let PopoverHeader = styled('header')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 2px;

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
`;

let PopoverFooter = styled('footer')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px 8px 14px;
  border-top: 1px solid ${theme.colors.gray300};
  font-size: 12px;
  color: ${theme.colors.gray600};
`;

let HighlightPill = ({
  item,
  active,
  onClick
}: {
  item: OptionListItem;
  active: boolean;
  onClick?: () => void;
}) => (
  <Pill
    type="button"
    $active={active}
    $hasCount={typeof item.count == 'number'}
    aria-pressed={active}
    onClick={onClick}
    tabIndex={onClick ? undefined : -1}
  >
    {item.label}
    {typeof item.count == 'number' && (
      <PillCount $active={active}>{item.count.toLocaleString()}</PillCount>
    )}
  </Pill>
);

let MorePopoverContent = ({
  filter,
  filters,
  filterState: [filterState, setFilterState],
  pillSelections
}: {
  filter: ListFilter;
  filters: TableFilterPayloadMap;
  filterState: FilterStateTuple;
  pillSelections?: PillSelections;
}) => {
  let [search, setSearch] = useState('');
  let selected = getListValue(filterState.find(f => f.id == filter.id));
  let options = useListFilterOptions(filter, search, filters, selected);

  return (
    <>
      <PopoverHeader>
        <h3>{getHighlightLabel(filter)}</h3>
      </PopoverHeader>

      <OptionList
        items={options.items}
        pinnedItems={options.pinnedItems}
        selected={selected}
        isLoading={options.isLoading}
        empty={options.empty}
        search={search}
        onSearch={setSearch}
        searchPlaceholder={`Search ${getHighlightLabel(filter).toLowerCase()}...`}
        onToggle={(id, checked) => {
          pillSelections?.mark(filter.id, id, checked);
          setFilterState(prev => toggleListValue(prev, filter, id, checked));
        }}
      />

      <PopoverFooter>
        <span>{selected.length ? `${selected.length} selected` : 'None selected'}</span>

        <Button
          size="1"
          variant="ghost"
          disabled={!selected.length}
          onClick={() => {
            pillSelections?.clear(filter.id);
            setFilterState(prev => removeFilterState(prev, filter.id));
          }}
        >
          Clear
        </Button>
      </PopoverFooter>
    </>
  );
};

export let FilterHighlightRow = ({
  filter,
  filterState,
  pillSelections
}: {
  filter: ListFilter;
  filterState: FilterStateTuple;
  pillSelections?: PillSelections;
}) => {
  let [state, setFilterState] = filterState;
  let filters = useMemo(() => getFilterPayload(state), [state]);
  let selected = getListValue(state.find(f => f.id == filter.id));
  let options = useListFilterOptions(filter, '', filters, selected);
  let [moreOpen, setMoreOpen] = useState(false);

  let candidates = useMemo(() => {
    let pinnedIds = new Set(options.pinnedItems.map(item => item.id));
    return [
      ...options.pinnedItems,
      ...options.items.filter(item => !pinnedIds.has(item.id))
    ].slice(0, PREVIEW_LIMIT);
  }, [options.items, options.pinnedItems]);

  let trackRef = useRef<HTMLDivElement>(null);
  let measureRef = useRef<HTMLDivElement>(null);
  let [visibleCount, setVisibleCount] = useState(candidates.length);

  useLayoutEffect(() => {
    let track = trackRef.current;
    let measure = measureRef.current;
    if (!track || !measure) return;

    let compute = () => {
      let children = Array.from(measure.children) as HTMLElement[];
      let more = children.pop();
      let available = track.clientWidth;
      let moreWidth = (more?.offsetWidth ?? 0) + GAP;
      let used = 0;
      let count = 0;

      for (let [i, child] of children.entries()) {
        let width = child.offsetWidth + (i > 0 ? GAP : 0);
        let isLast = i == children.length - 1;
        let reserve = isLast && filter.type == 'select' ? 0 : moreWidth;
        if (used + width + reserve > available) break;
        used += width;
        count++;
      }

      setVisibleCount(count);
    };

    compute();
    let observer = new ResizeObserver(compute);
    observer.observe(track);
    return () => observer.disconnect();
  }, [candidates, selected.join(','), filter.type]);

  let hiddenCount = candidates.length - visibleCount;
  let showMore = hiddenCount > 0 || filter.type == 'entity';
  let label = getHighlightLabel(filter);
  let toggle = (id: string) => {
    pillSelections?.mark(filter.id, id, !selected.includes(id));
    setFilterState(prev => toggleListValue(prev, filter, id));
  };

  return (
    <Row role="group" aria-label={label}>
      <RowLabel>{label}</RowLabel>

      <Track ref={trackRef}>
        <Measure ref={measureRef} aria-hidden>
          {candidates.map(item => (
            <HighlightPill key={item.id} item={item} active={selected.includes(item.id)} />
          ))}
          <MoreButton as="span">
            More <RiArrowDownSLine size={16} />
          </MoreButton>
        </Measure>

        {candidates.slice(0, visibleCount).map(item => (
          <HighlightPill
            key={item.id}
            item={item}
            active={selected.includes(item.id)}
            onClick={() => toggle(item.id)}
          />
        ))}

        {showMore && (
          <FilterPopover
            open={moreOpen}
            onOpenChange={setMoreOpen}
            align="end"
            width={320}
            label={`All ${label.toLowerCase()}`}
            trigger={
              <MoreButton type="button" aria-label={`Show all ${label.toLowerCase()}`}>
                More <RiArrowDownSLine size={16} />
              </MoreButton>
            }
          >
            <MorePopoverContent
              key={filter.id}
              filter={filter}
              filters={filters}
              filterState={filterState}
              pillSelections={pillSelections}
            />
          </FilterPopover>
        )}
      </Track>
    </Row>
  );
};

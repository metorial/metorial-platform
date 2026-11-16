import { ControlSizeProvider, type ControlSize } from '@metorial/ui';
import React, { useMemo } from 'react';
import { styled } from 'styled-components';
import {
  type FilterStateTuple,
  isExclusiveHighlight,
  isListFilter,
  type ListFilter,
  type SearchStateTuple
} from '../model/state';
import { usePillSelections } from '../model/pillSelections';
import type { TableFilter, TableFilterState } from '../model/tableFilter';
import { FilterHighlightRow } from './highlightRow';
import { FilterSearchBar } from './searchBar';
import type { FilterSuggestionGroup } from './suggestions';

let Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-width: 0;
`;

let Row = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;

  @media (max-width: 640px) {
    flex-wrap: wrap;
  }
`;

let Spacer = styled('div')`
  flex: 1;
`;

let EndSlot = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

export let FilterToolbar = ({
  filters,
  filterState,
  searchState,
  placeholder,
  suggestions,
  end,
  barEnd,
  size = '3',
  shortcut,
  style
}: {
  filters: TableFilter<any>[];
  filterState: FilterStateTuple;
  searchState?: SearchStateTuple;
  placeholder?: string;
  suggestions?: FilterSuggestionGroup[];
  end?: React.ReactNode;
  barEnd?: React.ReactNode;
  size?: ControlSize;
  shortcut?: boolean;
  style?: React.CSSProperties;
}) => {
  let pillSelections = usePillSelections(filterState[0]);
  let highlighted = useMemo(
    () => filters.filter((f): f is ListFilter => !!f.highlight && isListFilter(f)),
    [filters]
  );

  let [state, setState] = filterState;
  let barFilters = useMemo(() => filters.filter(f => !isExclusiveHighlight(f)), [filters]);
  let barFilterState = useMemo((): FilterStateTuple => {
    let exclusiveIds = new Set(filters.filter(f => isExclusiveHighlight(f)).map(f => f.id));
    if (!exclusiveIds.size) return [state, setState];

    let isExclusive = (s: TableFilterState) => exclusiveIds.has(s.id);
    return [
      state.filter(s => !isExclusive(s)),
      action =>
        setState(prev => {
          let rest = prev.filter(s => !isExclusive(s));
          let next = typeof action == 'function' ? action(rest) : action;
          return [...prev.filter(isExclusive), ...next.filter(s => !isExclusive(s))];
        })
    ];
  }, [filters, state, setState]);

  let hasBar = !!searchState || barFilters.length > 0;

  return (
    <ControlSizeProvider value={size}>
      <Wrapper style={style}>
        <Row>
          {hasBar ? (
            <FilterSearchBar
              filters={barFilters}
              filterState={barFilterState}
              searchState={searchState}
              placeholder={placeholder}
              suggestions={suggestions}
              shortcut={shortcut}
              pillSelections={pillSelections}
              barEnd={barEnd}
            />
          ) : (
            <Spacer />
          )}

          {end && <EndSlot>{end}</EndSlot>}
        </Row>

        {highlighted.map(filter => (
          <FilterHighlightRow
            key={filter.id}
            filter={filter}
            filterState={filterState}
            pillSelections={pillSelections}
          />
        ))}
      </Wrapper>
    </ControlSizeProvider>
  );
};

import { ControlSizeProvider, type ControlSize } from '@metorial/ui';
import React, { useMemo } from 'react';
import { styled } from 'styled-components';
import {
  type FilterStateTuple,
  isListFilter,
  type ListFilter,
  type SearchStateTuple
} from '../model/state';
import type { TableFilter } from '../model/tableFilter';
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
  size?: ControlSize;
  shortcut?: boolean;
  style?: React.CSSProperties;
}) => {
  let hasBar = !!searchState || filters.length > 0;
  let highlighted = useMemo(
    () => filters.filter((f): f is ListFilter => !!f.highlight && isListFilter(f)),
    [filters]
  );

  return (
    <ControlSizeProvider value={size}>
      <Wrapper style={style}>
        <Row>
          {hasBar ? (
            <FilterSearchBar
              filters={filters}
              filterState={filterState}
              searchState={searchState}
              placeholder={placeholder}
              suggestions={suggestions}
              shortcut={shortcut}
            />
          ) : (
            <Spacer />
          )}

          {end && <EndSlot>{end}</EndSlot>}
        </Row>

        {highlighted.map(filter => (
          <FilterHighlightRow key={filter.id} filter={filter} filterState={filterState} />
        ))}
      </Wrapper>
    </ControlSizeProvider>
  );
};

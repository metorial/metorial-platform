import { Input } from '@metorial/ui';
import { type Dispatch, type SetStateAction } from 'react';
import { styled } from 'styled-components';
import { TableFilter, TableFilterState } from './tableFilter';
import { TableFilters } from './tableFilters';

let Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  flex-wrap: nowrap;
  margin-bottom: 15px;
`;

let SearchWrapper = styled.div`
  flex: 1 1 auto;
  min-width: 220px;
`;

export let SearchFiltersToolbar = (p: {
  searchState: [string, Dispatch<SetStateAction<string>>];
  filterState: [TableFilterState[], Dispatch<SetStateAction<TableFilterState[]>>];
  filters: TableFilter<any>[];
  placeholder: string;
  defaultFilterId?: string;
}) => {
  let [search, setSearch] = p.searchState;
  let [filterState, setFilterState] = p.filterState;

  return (
    <Toolbar>
      <SearchWrapper>
        <Input
          label="Search"
          hideLabel
          size="2"
          placeholder={p.placeholder}
          value={search}
          onInput={setSearch}
        />
      </SearchWrapper>

      <TableFilters
        filters={p.filters}
        filterState={[filterState, setFilterState]}
        fullWidth={false}
        wrap={false}
        defaultFilterId={p.defaultFilterId ?? p.filters[0]?.id}
        resetCurrentFilterOnOpen
      />
    </Toolbar>
  );
};

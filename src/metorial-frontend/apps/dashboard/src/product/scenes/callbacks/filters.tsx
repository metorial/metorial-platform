import type { DashboardInstanceCallbacksListQuery } from '@metorial/dashboard-sdk';
import { Input } from '@metorial/ui';
import { type Dispatch, type SetStateAction, useMemo } from 'react';
import styled from 'styled-components';
import { useDebounced } from '@metorial/use-debounced';

let Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  flex-wrap: nowrap;
`;

let SearchWrapper = styled.div`
  flex: 1 1 auto;
  min-width: 220px;
`;

export let useCallbackFilters = (p: { search: string }) => {
  let searchDebounced = useDebounced(p.search, 500);

  let callbacksFilter = useMemo(
    (): DashboardInstanceCallbacksListQuery => ({
      ...(searchDebounced.trim() ? { search: searchDebounced.trim() } : {})
    }),
    [searchDebounced]
  );

  return {
    searchDebounced,
    callbacksFilter
  };
};

export let CallbackFilters = (p: {
  searchState: [string, Dispatch<SetStateAction<string>>];
}) => {
  let [search, setSearch] = p.searchState;

  return (
    <Toolbar>
      <SearchWrapper>
        <Input
          label="Search"
          hideLabel
          size="2"
          placeholder="Search callbacks..."
          value={search}
          onInput={setSearch}
        />
      </SearchWrapper>
    </Toolbar>
  );
};

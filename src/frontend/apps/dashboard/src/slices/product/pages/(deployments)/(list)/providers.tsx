import type { DashboardInstanceProviderListingsListQuery } from '@metorial/dashboard-sdk';
import { Spacer } from '@metorial/ui';
import { useState } from 'react';
import { useFilterQuery } from '../../../../../components/table/components/query';
import { TableFilterState } from '../../../../../components/table/filter';
import { ProvidersGrid } from '../../../scenes/providers/grid';
import {
  ProviderListingFilters,
  useProviderListingFilters
} from '../../../scenes/providers/filters';

export let ProvidersPage = () => {
  let [search, setSearch] = useState('');
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let { filters, searchDebounced, providerListingsFilter } = useProviderListingFilters({
    search,
    filterState
  });

  useFilterQuery({
    filters,
    filterState: [filterState, setFilterState],
    searchState: [search, setSearch],
    debouncedSearch: searchDebounced
  });

  return (
    <>
      <ProviderListingFilters
        searchState={[search, setSearch]}
        filterState={[filterState, setFilterState]}
        filters={filters}
      />

      <Spacer size={15} />

      <ProvidersGrid {...providerListingsFilter} limit={21} />
    </>
  );
};

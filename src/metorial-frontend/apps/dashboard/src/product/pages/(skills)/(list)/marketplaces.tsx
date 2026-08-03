import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { useState } from 'react';
import { useFilterQuery, TableFilterState } from '@metorial/table';
import {
  SkillResourceFilters,
  useSkillMarketplaceFilters
} from '../../../scenes/skills/filters';
import { SkillMarketplacesGrid } from '../../../scenes/skills/marketplaceGrid';

export let SkillMarketplacesPage = () => {
  let instance = useCurrentInstance();
  let [search, setSearch] = useState('');
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let { filters, searchDebounced, skillMarketplacesFilter } = useSkillMarketplaceFilters({
    search,
    filterState
  });

  useFilterQuery({
    filters,
    filterState: [filterState, setFilterState],
    searchState: [search, setSearch],
    debouncedSearch: searchDebounced
  });

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <SkillResourceFilters
        searchState={[search, setSearch]}
        filterState={[filterState, setFilterState]}
        filters={filters}
        placeholder="Search marketplaces..."
      />

      <SkillMarketplacesGrid instanceId={instance.data.id} {...skillMarketplacesFilter} />
    </>
  ));
};

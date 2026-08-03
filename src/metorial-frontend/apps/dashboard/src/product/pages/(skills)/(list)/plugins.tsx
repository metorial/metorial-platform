import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { useState } from 'react';
import { useFilterQuery, TableFilterState } from '@metorial/table';
import { SkillResourceFilters, useSkillPluginFilters } from '../../../scenes/skills/filters';
import { SkillPluginsGrid } from '../../../scenes/skills/pluginGrid';

export let SkillPluginsPage = () => {
  let instance = useCurrentInstance();
  let [search, setSearch] = useState('');
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let { filters, searchDebounced, skillPluginsFilter } = useSkillPluginFilters({
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
        placeholder="Search plugins..."
      />

      <SkillPluginsGrid instanceId={instance.data.id} {...skillPluginsFilter} />
    </>
  ));
};

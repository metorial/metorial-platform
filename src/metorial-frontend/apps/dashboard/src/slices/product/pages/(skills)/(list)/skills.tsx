import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { useState } from 'react';
import { useFilterQuery } from '../../../../../components/table/components/query';
import { TableFilterState } from '../../../../../components/table/filter';
import { SkillResourceFilters, useSkillFilters } from '../../../scenes/skills/filters';
import { SkillsGrid } from '../../../scenes/skills/grid';

export let SkillsPage = () => {
  let instance = useCurrentInstance();
  let [search, setSearch] = useState('');
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let { filters, searchDebounced, skillsFilter } = useSkillFilters({
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
        placeholder="Search skills..."
      />

      <SkillsGrid instanceId={instance.data.id} {...skillsFilter} />
    </>
  ));
};

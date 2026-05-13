import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Spacer } from '@metorial/ui';
import { useState } from 'react';
import { useFilterQuery } from '../../../../../components/table/components/query';
import { TableFilterState } from '../../../../../components/table/filter';
import { SkillResourceFilters, useSkillGroupFilters } from '../../../scenes/skills/filters';
import { SkillGroupsGrid } from '../../../scenes/skills/groupGrid';

export let SkillGroupsPage = () => {
  let instance = useCurrentInstance();
  let [search, setSearch] = useState('');
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let { filters, searchDebounced, skillGroupsFilter } = useSkillGroupFilters({
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
        placeholder="Search groups..."
      />

      <Spacer size={15} />

      <SkillGroupsGrid instanceId={instance.data.id} {...skillGroupsFilter} />
    </>
  ));
};

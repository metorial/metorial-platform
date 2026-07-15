import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { useState } from 'react';
import { useFilterQuery } from '../../../../../components/table/components/query';
import { TableFilterState } from '../../../../../components/table/filter';
import { SkillResourceFilters, useSkillTemplateFilters } from '../../../scenes/skills/filters';
import { SkillTemplatesGrid } from '../../../scenes/skills/templateGrid';

export let SkillTemplatesPage = () => {
  let instance = useCurrentInstance();
  let [search, setSearch] = useState('');
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let { filters, searchDebounced, skillTemplatesFilter } = useSkillTemplateFilters({
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
        placeholder="Search templates..."
      />

      <SkillTemplatesGrid instanceId={instance.data.id} {...skillTemplatesFilter} />
    </>
  ));
};

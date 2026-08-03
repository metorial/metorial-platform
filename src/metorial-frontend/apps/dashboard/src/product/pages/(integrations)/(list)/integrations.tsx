import { renderWithLoader } from '@metorial/data-hooks';
import { Spacer } from '@metorial/ui';
import { useState } from 'react';
import { useFilterQuery, TableFilterState } from '@metorial/table';
import { useCurrentInstance } from '@metorial/state';
import { IntegrationsGrid } from '../../../scenes/integrations/grid';
import {
  IntegrationFilters,
  useIntegrationFilters
} from '../../../scenes/integrations/filters';

export let IntegrationsPage = () => {
  let instance = useCurrentInstance();
  let [search, setSearch] = useState('');
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let { filters, searchDebounced, integrationsFilter } = useIntegrationFilters({
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
      <IntegrationFilters
        searchState={[search, setSearch]}
        filterState={[filterState, setFilterState]}
        filters={filters}
      />

      <Spacer size={15} />

      <IntegrationsGrid instanceId={instance.data.id} {...integrationsFilter} />
    </>
  ));
};

import { renderWithLoader } from '@metorial/data-hooks';
import { EmptyState } from '@metorial/empty-state';
import { useCurrentInstance } from '@metorial/state';
import { useFilterQuery, TableFilterState } from '@metorial/table';
import { Spacer } from '@metorial/ui';
import { useState } from 'react';
import { CallbacksGrid } from '../../../scenes/callbacks/callbacksGrid';
import { CallbackFilters, useCallbackFilters } from '../../../scenes/callbacks/filters';

export let CallbacksPage = () => {
  let instance = useCurrentInstance();
  let [search, setSearch] = useState('');
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let { searchDebounced, callbacksFilter } = useCallbackFilters({ search });

  useFilterQuery({
    filterState: [filterState, setFilterState],
    searchState: [search, setSearch],
    debouncedSearch: searchDebounced
  });

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <CallbackFilters searchState={[search, setSearch]} />

      <Spacer size={15} />

      <CallbacksGrid
        instanceId={instance.data.id}
        filters={callbacksFilter}
        emptyState={() => (
          <EmptyState
            extra="Callbacks"
            title="Enable callbacks for an integration"
            description="Callbacks let providers notify your application when interesting events happen, like new messages or status changes."
          />
        )}
      />
    </>
  ));
};

import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Flex, Input } from '@metorial/ui';
import { useState } from 'react';
import { useDebounce } from 'react-use';
import { useCompactUsageRange, UsageEventsCard } from '../../../scenes/instanceUsage';
import { ProviderAuthEventsTable } from '../../../scenes/providerAuthEvents/table';

export let ProviderAuthEventsPage = () => {
  let instance = useCurrentInstance();
  let { range, picker } = useCompactUsageRange();

  let [search, setSearch] = useState('');
  let [debouncedSearch, setDebouncedSearch] = useState('');
  useDebounce(() => setDebouncedSearch(search.trim()), 300, [search]);

  return renderWithLoader({ instance })(() => (
    <Flex direction="column" gap={16}>
      <UsageEventsCard
        title="Authentications"
        info="Authentication events over time, split into succeeded and failed attempts."
        range={range}
        kinds={['auth_event']}
        labels={{ success: 'Succeeded', error: 'Failed' }}
        collapseKey="logs-auth-events"
        height={160}
        hint={debouncedSearch ? 'Chart not filtered by search' : undefined}
        actions={picker}
      />

      <Input
        label="Search"
        hideLabel
        size="2"
        placeholder="Search by provider, auth method, auth config, credentials or event ID..."
        value={search}
        onInput={setSearch}
      />

      <ProviderAuthEventsTable linkToDetail limit={25} search={debouncedSearch || undefined} />
    </Flex>
  ));
};

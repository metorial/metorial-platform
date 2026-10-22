import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Flex } from '@metorial/ui';
import { useCompactUsageRange, UsageEventsCard } from '../../../scenes/instanceUsage';
import { ProviderAuthEventsTable } from '../../../scenes/providerAuthEvents/table';

export let ProviderAuthEventsPage = () => {
  let instance = useCurrentInstance();
  let { range, picker } = useCompactUsageRange();

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
        actions={picker}
      />

      <ProviderAuthEventsTable linkToDetail limit={25} />
    </Flex>
  ));
};

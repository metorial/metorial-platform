import { col, createDataList, EmptyValue } from '@metorial/data-list';
import { useProviderVersions } from '@metorial/state';
import { Badge } from '@metorial/ui';

let ProviderVersionsList = createDataList<{ instanceId: string; providerId: string }>(
  'provider-versions'
)
  .paginated(({ props }) => useProviderVersions(props.instanceId, props.providerId))
  .columns([
    col.text({
      id: 'version',
      header: 'Version',
      weight: 'strong',
      get: row => row.version,
      fallback: 'No version'
    }),
    col.custom({
      id: 'status',
      header: 'Status',
      render: row => (row.isCurrent ? <Badge color="blue">Current</Badge> : <EmptyValue />)
    }),
    col.createdAt(),
    col.id()
  ])
  .build();

export let ProviderVersionsTable = (p: { instanceId: string; providerId: string }) => (
  <ProviderVersionsList {...p} listVariant="embedded" emptyState="No versions found." />
);

import { DashboardInstanceProvidersVersionsListOutput } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { useProviderVersions } from '@metorial/state';
import { RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ProviderVersionsTable = ({
  instanceId,
  providerId
}: {
  instanceId: string;
  providerId: string;
}) => {
  let versions = useProviderVersions(instanceId, providerId);
  type ProviderVersion = DashboardInstanceProvidersVersionsListOutput['items'][number];

  return renderWithPagination(versions)(versions => (
    <>
      <Table
        headers={['Version', 'Status', 'Created']}
        data={versions.data.items.map((version: ProviderVersion) => ({
          data: [
            <Text size="2" weight="strong">
              {version.version ?? (
                <span style={{ color: theme.colors.gray600 }}>No version</span>
              )}
            </Text>,
            <Text size="2">{version.isCurrent ? 'current' : '—'}</Text>,
            <RenderDate date={version.createdAt} />
          ]
        }))}
      />

      {versions.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No versions found.
        </Text>
      )}
    </>
  ));
};

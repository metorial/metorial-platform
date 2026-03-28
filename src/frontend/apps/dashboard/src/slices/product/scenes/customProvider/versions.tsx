import {
  DashboardInstanceCustomProvidersGetOutput,
  DashboardInstanceCustomProvidersVersionsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCustomProviderVersions } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { CustomProviderVersionStatus } from './version';

export let CustomProviderVersionsTable = (
  filter: DashboardInstanceCustomProvidersVersionsListQuery & {
    customProvider: DashboardInstanceCustomProvidersGetOutput | undefined | null;
  }
) => {
  let instance = useCurrentInstance();
  let versions = useCustomProviderVersions(instance.data?.id, filter.customProvider?.id, {
    ...filter,
    order: 'desc'
  });

  return renderWithPagination(versions)(versions => (
    <>
      <Table
        headers={['Version', 'Status', 'Created']}
        data={versions.data.items.map(version => ({
          data: [
            <Text size="2" weight="strong">
              {version.index}
            </Text>,
            <CustomProviderVersionStatus version={version} />,
            <RenderDate date={version.createdAt} />
          ],
          href: Paths.instance.customProvider(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            filter.customProvider?.id,
            'versions',
            { version_id: version.id }
          )
        }))}
      />

      {versions.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No versions found for this provider.
        </Text>
      )}
    </>
  ));
};

import {
  DashboardInstanceCustomProvidersGetOutput,
  DashboardInstanceCustomProvidersVersionsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCustomProviderVersions } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { CustomServerVersionStatus } from './version';

export let CustomServerVersionsTable = (
  filter: DashboardInstanceCustomProvidersVersionsListQuery & {
    customServer: DashboardInstanceCustomProvidersGetOutput | undefined | null;
  }
) => {
  let instance = useCurrentInstance();
  let versions = useCustomProviderVersions(instance.data?.id, filter.customServer?.id, {
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
            <CustomServerVersionStatus version={version} />,
            <RenderDate date={version.createdAt} />
          ],
          href: Paths.instance.customServer(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            filter.customServer?.id,
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

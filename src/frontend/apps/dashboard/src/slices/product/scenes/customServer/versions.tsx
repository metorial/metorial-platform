import {
  DashboardInstanceCustomServersGetOutput,
  DashboardInstanceCustomServersVersionsListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCustomServerVersions } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { CustomServerVersionStatus } from './version';

export let CustomServerVersionsTable = (
  filter: DashboardInstanceCustomServersVersionsListQuery & {
    customServer: DashboardInstanceCustomServersGetOutput | undefined | null;
  }
) => {
  let instance = useCurrentInstance();
  let versions = useCustomServerVersions(instance.data?.id, filter.customServer?.id, {
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
              v{version.versionIndex}
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
          No versions found for this custom server.
        </Text>
      )}
    </>
  ));
};

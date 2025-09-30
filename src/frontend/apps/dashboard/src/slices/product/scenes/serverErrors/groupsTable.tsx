import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { DashboardInstanceServerRunErrorGroupsListQuery } from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { useCurrentInstance, useServerRunErrorGroups } from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ServerErrorGroupsTable = (
  filter: DashboardInstanceServerRunErrorGroupsListQuery
) => {
  let instance = useCurrentInstance();
  let errors = useServerRunErrorGroups(instance.data?.id, filter);

  return renderWithPagination(errors)(errors => (
    <>
      <Table
        headers={['Code', 'Message', 'Server', 'Count', 'First Seen', 'Last Seen']}
        data={errors.data.items.map(error => ({
          data: [
            <Badge color="red">{error.code}</Badge>,
            <Text size="2" weight="strong">
              {error.message}
            </Text>,
            <Text>{error.defaultError?.serverRun.server.name ?? 'Unknown'}</Text>,
            <Text>{error.count}</Text>,
            <RenderDate date={error.firstSeenAt} />,
            <RenderDate date={error.lastSeenAt} />
          ],
          href: Paths.instance.serverError(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            error.id
          )
        }))}
      />

      {errors.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No server errors found.
        </Text>
      )}
    </>
  ));
};

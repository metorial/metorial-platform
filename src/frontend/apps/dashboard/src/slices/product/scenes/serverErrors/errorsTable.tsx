import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { DashboardInstanceServerRunErrorsListQuery } from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { useCurrentInstance, useServerRunErrors } from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ServerErrorsTable = (filter: DashboardInstanceServerRunErrorsListQuery) => {
  let instance = useCurrentInstance();
  let errors = useServerRunErrors(instance.data?.id, filter);

  return renderWithPagination(errors)(errors => (
    <>
      <Table
        headers={['Code', 'Message', 'Deployment', 'Occurred At']}
        data={errors.data.items.map(error => ({
          data: [
            <Badge color="red">{error.code}</Badge>,
            <Text size="2" weight="strong">
              {error.message}
            </Text>,
            <Text>
              {error.serverRun.serverDeployment.name ?? (
                <span style={{ opacity: 0.6 }}>Untitled</span>
              )}
            </Text>,
            <RenderDate date={error.createdAt} />
          ],
          href: Paths.instance.serverRun(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            error.serverRun.id
          )
        }))}
      />

      {errors.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No server errors found
        </Text>
      )}
    </>
  ));
};

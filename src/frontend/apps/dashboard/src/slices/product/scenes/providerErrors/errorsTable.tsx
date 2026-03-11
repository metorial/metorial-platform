import { DashboardInstanceSessionsErrorsListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useAllSessionErrors, useCurrentInstance } from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ServerErrorsTable = (filter: DashboardInstanceSessionsErrorsListQuery) => {
  let instance = useCurrentInstance();
  let errors = useAllSessionErrors(instance.data?.id, filter);

  return renderWithPagination(errors)(errors => (
    <>
      <Table
        headers={['Type', 'Message', 'Provider Run', 'Occurred At']}
        data={errors.data.items.map(error => ({
          data: [
            <Badge color="red">{error.code ?? 'Unknown'}</Badge>,
            <Text size="2" weight="strong">
              {error.message ?? 'No message'}
            </Text>,
            <Text>{error.providerRunId ?? <span style={{ opacity: 0.6 }}>N/A</span>}</Text>,
            <RenderDate date={error.createdAt} />
          ],
          href: error.providerRunId
            ? Paths.instance.providerRun(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                error.providerRunId
              )
            : undefined
        }))}
      />

      {errors.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No provider errors found.
        </Text>
      )}
    </>
  ));
};

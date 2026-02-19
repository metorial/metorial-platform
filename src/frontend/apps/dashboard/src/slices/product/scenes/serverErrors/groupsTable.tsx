import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useAllSessionErrorGroups } from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ServerErrorGroupsTable = (filter?: { sessionId?: string; type?: string }) => {
  let instance = useCurrentInstance();
  let errors = useAllSessionErrorGroups(instance.data?.id, {
    sessionId: filter?.sessionId,
    type: filter?.type
  });

  return renderWithPagination(errors)(errors => (
    <>
      <Table
        headers={['Type', 'Name', 'Message', 'Count', 'Created']}
        data={errors.data.items.map(error => ({
          data: [
            error.type ? (
              <Badge color="red">{error.type}</Badge>
            ) : (
              <Badge color="gray">Unknown</Badge>
            ),
            <Text size="2" weight="strong">
              {error.name ?? '—'}
            </Text>,
            <Text size="2">
              {error.message?.slice(0, 80)}
              {error.message && error.message.length > 80 ? '...' : ''}
            </Text>,
            <Text size="2">{error.count ?? '—'}</Text>,
            <RenderDate date={error.createdAt} />
          ],
          href: Paths.instance.providerError(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            error.id
          )
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

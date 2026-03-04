import { DashboardInstanceSessionsErrorGroupsListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useSessionErrorGroups } from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

type SessionErrorGroupTypeFilter = Extract<
  DashboardInstanceSessionsErrorGroupsListQuery['type'],
  | 'message_processing_timeout'
  | 'message_processing_provider_error'
  | 'message_processing_system_error'
>;

let normalizeSessionErrorGroupType = (
  type?: string
): SessionErrorGroupTypeFilter | undefined => {
  if (
    type === 'message_processing_timeout' ||
    type === 'message_processing_provider_error' ||
    type === 'message_processing_system_error'
  ) {
    return type;
  }
  return undefined;
};

export let ServerErrorGroupsTable = (filter?: { sessionId?: string; type?: string }) => {
  let instance = useCurrentInstance();
  let errors = useSessionErrorGroups(instance.data?.id, {
    sessionId: filter?.sessionId,
    type: normalizeSessionErrorGroupType(filter?.type)
  });

  return renderWithPagination(errors)(errors => (
    <>
      <Table
        headers={['Code', 'Message', 'Count', 'Created']}
        data={errors.data.items.map(error => ({
          data: [
            error.code ? (
              <Badge color="red">{error.code}</Badge>
            ) : (
              <Badge color="gray">Unknown</Badge>
            ),
            <Text size="2">
              {error.message?.slice(0, 80)}
              {error.message && error.message.length > 80 ? '...' : ''}
            </Text>,
            <Text size="2">{error.occurrenceCount ?? '—'}</Text>,
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

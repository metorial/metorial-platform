import { DashboardInstancePortalsConsumerProfilesListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, usePortalConsumerProfiles } from '@metorial/state';
import { Flex, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let PortalConsumerProfilesTable = (
  filter: DashboardInstancePortalsConsumerProfilesListQuery & {
    portalId: string | undefined;
  }
) => {
  let instance = useCurrentInstance();
  let groups = usePortalConsumerProfiles(instance.data?.id, filter.portalId, filter);

  return renderWithPagination(groups)(groups => (
    <>
      <Table
        headers={['Info', 'Created']}
        data={groups.data.items.map(group => ({
          data: [
            <Flex gap={3} direction="column">
              <Text size="2" weight="strong">
                {group.name ?? <span>Untitled</span>}
              </Text>
              <Text size="1" color="gray600" truncate>
                {group.email}
              </Text>
            </Flex>,
            <RenderDate date={group.createdAt} />
          ],
          href: Paths.instance.portal(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            filter.portalId,
            'user',
            group.id
          )
        }))}
      />

      {groups.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No consumer groups found.
        </Text>
      )}
    </>
  ));
};

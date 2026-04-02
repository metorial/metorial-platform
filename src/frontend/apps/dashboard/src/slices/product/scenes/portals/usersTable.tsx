import { DashboardInstancePortalsConsumerProfilesListQuery } from '@metorial/dashboard-sdk';
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
  let profiles = usePortalConsumerProfiles(instance.data?.id, filter.portalId, filter);

  return renderWithPagination(profiles, {
    hidePaginationWhenUnavailable: true
  })(profiles => (
    <>
      <Table
        headers={['Info', 'Created']}
        data={profiles.data.items.map(profile => ({
          data: [
            <Flex gap={3} direction="column">
              <Text size="2" weight="strong">
                {profile.name || 'Untitled User'}
              </Text>
              <Text size="1" color="gray600" truncate>
                {profile.email}
              </Text>
            </Flex>,
            <RenderDate date={profile.createdAt} />
          ],
          href: Paths.instance.portal(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            filter.portalId,
            'user',
            profile.id
          )
        }))}
      />

      {profiles.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No users found for this portal.
        </Text>
      )}
    </>
  ));
};

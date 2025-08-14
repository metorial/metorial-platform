import {
  DashboardInstanceProviderOauthConnectionsGetOutput,
  DashboardInstanceProviderOauthConnectionsProfilesListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderConnectionProfiles } from '@metorial/state';
import { RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ProviderConnectionProfilesTable = (
  filter: DashboardInstanceProviderOauthConnectionsProfilesListQuery & {
    providerConnection: DashboardInstanceProviderOauthConnectionsGetOutput | undefined | null;
  }
) => {
  let instance = useCurrentInstance();
  let profiles = useProviderConnectionProfiles(
    instance.data?.id,
    filter.providerConnection?.id,
    {
      ...filter,
      order: 'desc'
    }
  );

  return renderWithPagination(profiles)(profiles => (
    <>
      <Table
        headers={['Info', 'Last Used', 'Created']}
        data={profiles.data.items.map(profile => ({
          data: [
            <Text size="2" weight="strong">
              {profile.name ?? <span style={{ color: theme.colors.gray600 }}>Untitled</span>}

              {profile.email && (
                <Text size="2" color="gray600">
                  providerConnection.email
                </Text>
              )}
            </Text>,
            <RenderDate date={profile.lastUsedAt} />,
            <RenderDate date={profile.createdAt} />
          ],
          href: Paths.instance.providerConnection(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            filter.providerConnection?.id,
            'profiles',
            { profile_id: profile.id }
          )
        }))}
      />

      {profiles.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No oauth profiles found for this connection
        </Text>
      )}
    </>
  ));
};

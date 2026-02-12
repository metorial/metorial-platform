// Types removed in Provider API migration
type ProviderConnectionData = { id: string; name: string | null; [key: string]: unknown };
type ProviderConnectionProfilesListQuery = Record<string, unknown>;
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderConnectionProfiles } from '@metorial/state';
import { RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ProviderConnectionProfilesTable = (
  filter: ProviderConnectionProfilesListQuery & {
    providerConnection: ProviderConnectionData | undefined | null;
  }
) => {
  let instance = useCurrentInstance();
  let profiles = useProviderConnectionProfiles(
    instance.data?.instanceId,
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
        data={profiles.data.items.map((profile: { id: string; name: string | null; email: string | null; lastUsedAt: Date | null; createdAt: Date }) => ({
          data: [
            <Text size="2" weight="strong">
              {profile.name ?? <span style={{ color: theme.colors.gray600 }}>Untitled</span>}

              {profile.email && (
                <Text size="2" color="gray600">
                  providerConnection.email
                </Text>
              )}
            </Text>,
            profile.lastUsedAt ? <RenderDate date={profile.lastUsedAt} /> : 'Never',
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
          No oauth profiles found for this connection.
        </Text>
      )}
    </>
  ));
};

import {
  DashboardInstanceProviderOauthConnectionsAuthenticationsListQuery,
  DashboardInstanceProviderOauthConnectionsGetOutput
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderConnectionAuthentications } from '@metorial/state';
import { Badge, RenderDate, Text, theme } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { switcher } from '../../../../lib/switcher';

export let ProviderConnectionAuthenticationsTable = (
  filter: DashboardInstanceProviderOauthConnectionsAuthenticationsListQuery & {
    providerConnection: DashboardInstanceProviderOauthConnectionsGetOutput | undefined | null;
  }
) => {
  let instance = useCurrentInstance();
  let authentications = useProviderConnectionAuthentications(
    instance.data?.id,
    filter.providerConnection?.id,
    {
      ...filter,
      order: 'desc'
    }
  );

  return renderWithPagination(authentications)(authentications => (
    <>
      <Table
        headers={['Status', 'Type', 'Info', 'Created']}
        data={authentications.data.items.map(authentication => ({
          data: [
            {
              completed: <Badge color="blue">Completed</Badge>,
              failed: <Badge color="orange">Failed</Badge>,
              provider_disabled: <Badge color="gray">Provider Disabled</Badge>
            }[authentication.status] ?? authentication.status,
            <Text size="2" weight="strong">
              Authentication
            </Text>,
            <Text size="2">
              {switcher({
                completed: () =>
                  authentication.profile ? (
                    (authentication.profile.email ??
                    authentication.profile.name ?? <ID id={authentication.profile.sub} />)
                  ) : (
                    <span style={{ color: theme.colors.gray600 }}>No profile</span>
                  ),
                failed: () => authentication.error?.message ?? 'Unknown Error',
                provider_disabled: () => 'The provider connection has been disabled'
              })(authentication.status)}
            </Text>,
            <RenderDate date={authentication.createdAt} />
          ],
          href: Paths.instance.providerConnection(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            filter.providerConnection?.id,
            'logs',
            { authentication_id: authentication.id }
          )
        }))}
      />

      {authentications.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No oauth logs found for this connection
        </Text>
      )}
    </>
  ));
};

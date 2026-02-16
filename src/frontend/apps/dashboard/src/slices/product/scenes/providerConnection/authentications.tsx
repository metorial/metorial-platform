import React from 'react';
// Types removed in Provider API migration - using inline types
type ProviderConnectionData = { id: string; name: string | null; [key: string]: unknown };
type ProviderConnectionAuthenticationsListQuery = Record<string, unknown>;
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderConnectionAuthentications } from '@metorial/state';
import { Badge, RenderDate, Text, theme } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { switcher } from '../../../../lib/switcher';

export let ProviderConnectionAuthenticationsTable = (
  filter: ProviderConnectionAuthenticationsListQuery & {
    providerConnection: ProviderConnectionData | undefined | null;
  }
) => {
  let instance = useCurrentInstance();
  let authentications = useProviderConnectionAuthentications(
    instance.data?.instanceId,
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
        data={authentications.data.items.map((authentication: { id: string; status: string | null; profile: { email: string | null; name: string | null; sub: string | null } | null; error?: { message: string } | null; createdAt: Date }) => ({
          data: [
            ({
              completed: <Badge color="blue">Completed</Badge>,
              failed: <Badge color="orange">Failed</Badge>,
              provider_disabled: <Badge color="gray">Provider Disabled</Badge>
            } as Record<string, React.ReactNode>)[authentication.status ?? ''] ?? authentication.status,
            <Text size="2" weight="strong">
              Authentication
            </Text>,
            <Text size="2">
              {switcher({
                completed: () =>
                  authentication.profile ? (
                    (authentication.profile.email ??
                    authentication.profile.name ?? <ID id={authentication.profile.sub ?? undefined} />)
                  ) : (
                    <span style={{ color: theme.colors.gray600 }}>No profile</span>
                  ),
                failed: () => authentication.error?.message ?? 'Unknown Error',
                provider_disabled: () => 'The provider connection has been disabled'
              })((authentication.status ?? 'completed') as 'completed' | 'failed' | 'provider_disabled')}
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
          No oauth logs found for this connection.
        </Text>
      )}
    </>
  ));
};

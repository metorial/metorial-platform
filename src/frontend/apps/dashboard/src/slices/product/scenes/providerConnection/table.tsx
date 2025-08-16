import {
  DashboardInstanceProviderOauthConnectionsGetOutput,
  DashboardInstanceProviderOauthConnectionsListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderConnections } from '@metorial/state';
import { Avatar, Entity, RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { Link } from 'react-router-dom';

export let ProviderConnectionsTable = (
  filter: DashboardInstanceProviderOauthConnectionsListQuery
) => {
  let instance = useCurrentInstance();
  let providerConnections = useProviderConnections(instance.data?.id, {
    ...filter,
    order: 'desc'
  });

  return renderWithPagination(providerConnections)(providerConnections => (
    <>
      <Table
        headers={['Info', 'Provider', 'Created']}
        data={providerConnections.data.items.map(providerConnection => ({
          data: [
            <Text size="2" weight="strong">
              {providerConnection.name ?? (
                <span style={{ color: theme.colors.gray600 }}>Untitled</span>
              )}

              {providerConnection.description && (
                <Text size="2" color="gray600">
                  {providerConnection.description.slice(0, 60)}
                  {providerConnection.description.length > 60 ? '...' : ''}
                </Text>
              )}
            </Text>,
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <Avatar entity={providerConnection.provider} size={24} />

              <Text size="2" weight="strong">
                {providerConnection.provider.name}
              </Text>
            </div>,
            <RenderDate date={providerConnection.createdAt} />
          ],
          href: Paths.instance.providerConnection(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            providerConnection.id
          )
        }))}
      />

      {providerConnections.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No oauth connections found.
        </Text>
      )}
    </>
  ));
};

export let ProviderConnectionsList = (
  filter: DashboardInstanceProviderOauthConnectionsListQuery & {
    onProviderConnectionClick?: (
      providerConnection: DashboardInstanceProviderOauthConnectionsGetOutput
    ) => void;
  }
) => {
  let instance = useCurrentInstance();
  let providerConnections = useProviderConnections(instance.data?.id, filter);

  return renderWithPagination(providerConnections)(providerConnections => (
    <ProviderConnectionsListItems
      providerConnections={providerConnections.data.items}
      onProviderConnectionClick={filter.onProviderConnectionClick as any}
    />
  ));
};

export let ProviderConnectionsListItems = ({
  providerConnections,
  onProviderConnectionClick
}: {
  providerConnections: DashboardInstanceProviderOauthConnectionsGetOutput[];
  onProviderConnectionClick?: (
    providerConnection: DashboardInstanceProviderOauthConnectionsGetOutput
  ) => void;
}) => {
  let instance = useCurrentInstance();

  return (
    <>
      {providerConnections.map(providerConnection => {
        let inner = (
          <Entity.Wrapper>
            <Entity.Content>
              <Entity.Field
                title={
                  providerConnection.name ?? (
                    <span style={{ color: theme.colors.gray600 }}>Untitled</span>
                  )
                }
                description={
                  providerConnection.description && (
                    <>
                      {providerConnection.description.slice(0, 60)}
                      {providerConnection.description.length > 60 ? '...' : ''}
                    </>
                  )
                }
              />

              <Entity.Field
                title={<Text size="2">{providerConnection.provider.name}</Text>}
                value={providerConnection.provider.url}
              />

              <Entity.Field title={<RenderDate date={providerConnection.createdAt} />} />
            </Entity.Content>
          </Entity.Wrapper>
        );

        if (onProviderConnectionClick) {
          return (
            <button
              key={providerConnection.id}
              onClick={() => {
                onProviderConnectionClick(providerConnection);
              }}
              style={{
                padding: 0,
                border: 'none',
                background: 'none',
                width: '100%',
                textAlign: 'left'
              }}
            >
              {inner}
            </button>
          );
        }

        return (
          <Link
            to={Paths.instance.providerConnection(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              providerConnection.id
            )}
          >
            {inner}
          </Link>
        );
      })}

      {providerConnections.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No oauth connections found.
        </Text>
      )}
    </>
  );
};

import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useInstanceProviderAuthCredentials,
  useProviders
} from '@metorial/state';
import { Badge, Input, RenderDate, Spacer, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useMemo } from 'react';
import { EmptyState } from '../../../../../components/emptyState';
import { useSearchFilter } from '../../../../../hooks/useSearchFilter';
import { showCreateProviderAuthCredentialsFlow } from './providerCreationFlows';

export let ProviderAuthCredentialsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { search, setSearch, searchQuery } = useSearchFilter();

  let authCredentials = useInstanceProviderAuthCredentials(instance.data?.id, {
    limit: 20,
    search: searchQuery
  });

  let items = authCredentials.data?.items ?? [];
  let providerIds = useMemo(
    () => [...new Set(items.map(credential => credential.providerId).filter(Boolean))],
    [items]
  );

  let providerQuery = useMemo(
    () =>
      !authCredentials.isLoading && !authCredentials.error && providerIds.length === 0
        ? { limit: 20 }
        : { id: providerIds },
    [authCredentials.error, authCredentials.isLoading, providerIds]
  );

  let providers = useProviders(instance.data?.id, providerQuery);
  let providerNameMap = useMemo(() => {
    let map = new Map<string, string>();
    for (let provider of providers.data?.items ?? []) {
      if (provider.id && provider.name) map.set(provider.id, provider.name);
    }
    return map;
  }, [providers.data?.items]);

  let rows = useMemo(() => items, [items]);

  let table = (
    <Table
      headers={['Name', 'Provider', 'Type', 'Default', 'Created']}
      data={rows.map(row => ({
        data: [
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Text size="2" weight="strong">
              {row.name || '—'}
            </Text>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {row.isDefault && (
                <Badge color="blue" size="1">
                  Default
                </Badge>
              )}
              {row.isManaged && (
                <Badge color="gray" size="1">
                  Managed by Metorial
                </Badge>
              )}
            </div>
          </div>,
          <Text size="2">{providerNameMap.get(row.providerId) ?? row.providerId}</Text>,
          <Text size="2">{row.type}</Text>,
          row.isDefault ? (
            <Badge color="blue" size="1">
              Default
            </Badge>
          ) : (
            <Text size="2">No</Text>
          ),
          row.createdAt ? (
            <RenderDate date={row.createdAt} />
          ) : (
            <Text size="2" color="gray600">
              —
            </Text>
          )
        ]
      }))}
    />
  );
  let authCredentialsContent = renderWithPagination(authCredentials)(() => table);
  return renderWithLoader({
    organization,
    project,
    instance,
    authCredentials
  })(() => {
    let hasSearch = (searchQuery ?? '').trim().length > 0;

    return (
      <>
        <Input
          label="Search"
          hideLabel
          placeholder="Search auth credentials..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <Spacer size={15} />

        {rows.length === 0 ? (
          hasSearch ? (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No auth credentials found for "{searchQuery}".
            </Text>
          ) : (
            <EmptyState
              title="Create your first auth credentials"
              description="Auth credentials store the provider access details your instance can reuse."
              action={{
                label: 'Create Auth Credentials',
                onClick: () => {
                  if (instance.data?.id) {
                    showCreateProviderAuthCredentialsFlow(instance.data.id);
                  }
                }
              }}
            />
          )
        ) : (
          renderWithLoader({ providers })(() => authCredentialsContent)
        )}
      </>
    );
  });
};

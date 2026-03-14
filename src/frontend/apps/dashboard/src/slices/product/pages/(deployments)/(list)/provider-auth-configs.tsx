import { DashboardInstanceProviderDeploymentsAuthConfigsListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useInstanceProviderAuthConfigs,
  useProviders
} from '@metorial/state';
import { Badge, Input, RenderDate, Spacer, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useMemo } from 'react';
import { EmptyState } from '../../../../../components/emptyState';
import { useSearchFilter } from '../../../../../hooks/useSearchFilter';
import { showCreateProviderAuthConfigFlow } from './providerCreationFlows';

type AuthConfigItem =
  DashboardInstanceProviderDeploymentsAuthConfigsListOutput['items'][number];

let formatType = (type: string | null | undefined) => {
  if (type === 'oauth_automated') return 'OAuth (Automated)';
  if (type === 'oauth_manual') return 'OAuth (Manual)';
  if (type === 'manual') return 'Manual';
  return '\u2014';
};

let formatSource = (source: AuthConfigItem['source'] | null | undefined) => {
  if (source === 'manual') return 'Manual';
  if (source === 'setup_session') return 'Setup Session';
  if (source === 'system') return 'System';
  return '\u2014';
};

export let ProviderAuthConfigsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { search, setSearch, searchQuery } = useSearchFilter();
  let authConfigs = useInstanceProviderAuthConfigs(instance.data?.id, {
    limit: 20,
    search: searchQuery
  });
  let items = authConfigs.data?.items ?? [];

  let providerIds = useMemo(
    () => [...new Set(items.map(item => item.providerId).filter(Boolean))],
    [items]
  );

  let providerQuery = useMemo(
    () =>
      !authConfigs.isLoading && !authConfigs.error && providerIds.length === 0
        ? { limit: 20 }
        : { id: providerIds },
    [authConfigs.error, authConfigs.isLoading, providerIds]
  );

  let providers = useProviders(instance.data?.id, providerQuery);
  let providerNameMap = useMemo(() => {
    let map = new Map<string, string>();
    for (let provider of providers.data?.items ?? []) {
      if (provider.id && provider.name) map.set(provider.id, provider.name);
    }
    return map;
  }, [providers.data?.items]);

  let rows = useMemo(() => {
    return items.map(config => ({
      key: config.id,
      name: config.name,
      type: config.type,
      source: config.source,
      status: config.status,
      isDefault: config.isDefault,
      authMethodName: config.authMethod?.name ?? config.authMethod?.key ?? null,
      providerId: config.providerId,
      providerName: providerNameMap.get(config.providerId) ?? null,
      providerDeploymentId: config.deploymentPreview?.id ?? null,
      createdAt: config.createdAt
    }));
  }, [items, providerNameMap]);

  let authConfigsContent = renderWithPagination(authConfigs)(() => (
    <Table
      headers={[
        'Name',
        'Auth Method',
        'Type',
        'Source',
        'Status',
        'Default',
        'Provider',
        'Created'
      ]}
      data={rows.map(row => ({
        href: row.providerDeploymentId
          ? Paths.instance.providerAuthConfig(
              organization.data,
              project.data,
              instance.data,
              row.providerDeploymentId,
              row.key
            )
          : undefined,
        data: [
          <Text size="2" weight="strong">
            {row.name || '\u2014'}
          </Text>,
          <Text size="2">{row.authMethodName ?? '\u2014'}</Text>,
          <Text size="2">{formatType(row.type)}</Text>,
          <Text size="2">{formatSource(row.source)}</Text>,
          <Badge color={row.status === 'active' ? 'green' : 'gray'}>{row.status}</Badge>,
          row.isDefault ? <Badge color="blue">Default</Badge> : <Text size="2">No</Text>,
          <Text size="2">{row.providerName ?? row.providerId}</Text>,
          row.createdAt ? (
            <RenderDate date={row.createdAt} />
          ) : (
            <Text size="2" color="gray600">
              {'\u2014'}
            </Text>
          )
        ]
      }))}
    />
  ));

  return renderWithLoader({ organization, project, instance, authConfigs })(() => {
    let hasSearch = (searchQuery ?? '').trim().length > 0;

    return (
      <>
        <Input
          label="Search"
          hideLabel
          placeholder="Search auth configs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <Spacer size={15} />

        {rows.length === 0 ? (
          hasSearch ? (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No auth configs found for "{searchQuery}".
            </Text>
          ) : (
            <EmptyState
              title="Create your first auth config"
              description="Auth configs connect providers to the authentication settings your instance should use."
              action={{
                label: 'Create Auth Config',
                onClick: () => {
                  if (instance.data?.id) {
                    showCreateProviderAuthConfigFlow(instance.data.id, {
                      scope: 'provider'
                    });
                  }
                }
              }}
            />
          )
        ) : (
          renderWithLoader({ providers })(() => authConfigsContent)
        )}
      </>
    );
  });
};

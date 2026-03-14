import { DashboardInstanceProviderDeploymentsConfigsListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useInstanceProviderConfigs,
  useProviders
} from '@metorial/state';
import { Input, RenderDate, Spacer, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useMemo } from 'react';
import { EmptyState } from '../../../../../components/emptyState';
import { useSearchFilter } from '../../../../../hooks/useSearchFilter';
import { showCreateProviderConfigFlow } from './providerCreationFlows';

type ConfigOverviewRow = {
  config: DashboardInstanceProviderDeploymentsConfigsListOutput['items'][number];
  providerDeploymentId?: string;
  providerDeploymentName?: string | null;
};

export let ProviderConfigsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { search, setSearch, searchQuery } = useSearchFilter();

  let configs = useInstanceProviderConfigs(instance.data?.id, {
    limit: 20,
    search: searchQuery
  });

  let providerIds = useMemo(
    () => [
      ...new Set(
        (configs.data?.items ?? [])
          .map(
            config =>
              config.deployment?.providerId ??
              config.fromVault?.deployment?.providerId ??
              config.providerId
          )
          .filter(Boolean)
      )
    ],
    [configs.data?.items]
  );

  let providerQuery = useMemo(
    () =>
      !configs.isLoading && !configs.error && providerIds.length === 0
        ? { limit: 20 }
        : { id: providerIds },
    [configs.error, configs.isLoading, providerIds]
  );

  let providers = useProviders(instance.data?.id, providerQuery);
  let providerNameMap = useMemo(() => {
    let map = new Map<string, string>();
    for (let provider of providers.data?.items ?? []) {
      map.set(provider.id, provider.name);
    }
    return map;
  }, [providers.data?.items]);

  let rows = useMemo(() => {
    let nextRows: ConfigOverviewRow[] = [];
    for (let config of configs.data?.items ?? []) {
      let providerDeploymentId = config.deployment?.id ?? config.fromVault?.deployment?.id;
      let providerDeploymentName =
        config.deployment?.name ?? config.fromVault?.deployment?.name;

      nextRows.push({
        config,
        providerDeploymentId,
        providerDeploymentName
      });
    }

    return nextRows;
  }, [configs.data?.items]);
  let table = (
    <Table
      headers={['Config Name', 'Provider', 'Deployment', 'Created']}
      data={rows.map(row => ({
        href: row.providerDeploymentId
          ? Paths.instance.providerConfig(
              organization.data,
              project.data,
              instance.data,
              row.providerDeploymentId,
              row.config.id
            )
          : undefined,
        data: [
          <Text size="2" weight="strong">
            {row.config.name ?? 'Unnamed'}
          </Text>,
          <Text size="2">
            {providerNameMap.get(
              row.config.deployment?.providerId ??
                row.config.fromVault?.deployment?.providerId ??
                row.config.providerId
            ) ??
              row.config.deployment?.providerId ??
              row.config.fromVault?.deployment?.providerId ??
              row.config.providerId}
          </Text>,
          row.providerDeploymentName ? (
            <Text size="2">{row.providerDeploymentName}</Text>
          ) : (
            <Text size="2" color="gray600">
              Provider-level
            </Text>
          ),
          row.config.createdAt ? (
            <RenderDate date={row.config.createdAt} />
          ) : (
            <Text size="2" color="gray600">
              —
            </Text>
          )
        ]
      }))}
    />
  );

  let configsContent = renderWithPagination(configs)(() => table);

  return renderWithLoader({
    organization,
    project,
    instance,
    configs
  })(() => {
    let hasSearch = (searchQuery ?? '').trim().length > 0;

    return (
      <>
        <Input
          label="Search"
          hideLabel
          placeholder="Search configs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <Spacer size={15} />

        {rows.length === 0 ? (
          hasSearch ? (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No configs found for "{searchQuery}".
            </Text>
          ) : (
            <EmptyState
              title="Create your first config"
              description="Configs let you save reusable provider settings for this instance."
              action={{
                label: 'Create Config',
                onClick: () => {
                  if (instance.data?.id) {
                    showCreateProviderConfigFlow(instance.data.id);
                  }
                }
              }}
            />
          )
        ) : (
          renderWithLoader({ providers })(() => configsContent)
        )}
      </>
    );
  });
};

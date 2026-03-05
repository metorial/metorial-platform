import {
  DashboardInstanceProviderDeploymentsConfigsListOutput,
  DashboardInstanceProviderDeploymentsListOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useInstanceProviderConfigs,
  useProviderDeployments,
  useProviders
} from '@metorial/state';
import { Badge, Input, RenderDate, Spacer, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useMemo, useState } from 'react';
import { useDebounced } from '../../../../../hooks/useDebounced';

type ConfigOverviewRow = {
  config: DashboardInstanceProviderDeploymentsConfigsListOutput['items'][number];
  deployment: DashboardInstanceProviderDeploymentsListOutput['items'][number];
};

export let ProviderConfigsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  let deployments = useProviderDeployments(instance.data?.id, {
    limit: 100
  });

  let deploymentItems = deployments.data?.items ?? [];
  let deploymentIds = useMemo(
    () => deploymentItems.map(deployment => deployment.id),
    [deploymentItems]
  );
  let configs = useInstanceProviderConfigs(
    instance.data?.id,
    deploymentIds.length > 0
      ? {
          providerDeploymentId: deploymentIds,
          search: searchDebounced
        }
      : null
  );
  let providerIds = useMemo(
    () => [
      ...new Set(deploymentItems.map(deployment => deployment.providerId).filter(Boolean))
    ],
    [deploymentItems]
  );
  let providers = useProviders(
    instance.data?.id,
    providerIds.length > 0 ? { id: providerIds } : null
  );
  let providerNameMap = useMemo(() => {
    let map = new Map<string, string>();
    for (let provider of providers.data?.items ?? []) {
      map.set(provider.id, provider.name);
    }
    return map;
  }, [providers.data?.items]);
  let rows = useMemo(() => {
    let deploymentById = new Map<
      string,
      DashboardInstanceProviderDeploymentsListOutput['items'][number]
    >();
    for (let deployment of deploymentItems) {
      deploymentById.set(deployment.id, deployment);
    }

    let nextRows: ConfigOverviewRow[] = [];
    for (let config of configs.data?.items ?? []) {
      let deployment =
        (config.deployment?.id ? deploymentById.get(config.deployment.id) : null) ??
        deploymentById.values().next().value;
      if (!deployment) continue;

      nextRows.push({
        config,
        deployment
      });
    }

    return nextRows;
  }, [configs.data?.items, deploymentItems]);
  let configsContent = renderWithPagination(configs, {
    emptyState: (
      <Text size="2" color="gray600">
        No configs found.
      </Text>
    )
  })(() =>
    rows.length > 0 ? (
      <Table
        headers={['Config Name', 'Provider', 'Version', 'Created']}
        data={rows.map(row => ({
          href: Paths.instance.providerConfig(
            organization.data,
            project.data,
            instance.data,
            row.deployment.id,
            row.config.id
          ),
          data: [
            <Text size="2" weight="strong">
              {row.config.name ?? 'Unnamed'}
            </Text>,
            <Text size="2">
              {providerNameMap.get(row.deployment.providerId) ?? row.deployment.providerId}
            </Text>,
            row.deployment.lockedVersion ? (
              <Badge color="purple" size="1">
                {row.deployment.lockedVersion.version}
              </Badge>
            ) : (
              <Badge color="gray" size="1">
                Default
              </Badge>
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
    ) : (
      <Text size="2" color="gray600">
        No configs found.
      </Text>
    )
  );

  return renderWithLoader({ organization, project, instance, deployments })(() => (
    <>
      <Input
        label="Search"
        hideLabel
        placeholder="Search configs..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <Spacer size={15} />

      {configsContent}
    </>
  ));
};

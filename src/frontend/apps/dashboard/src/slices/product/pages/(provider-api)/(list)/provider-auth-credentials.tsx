import {
  DashboardInstanceProviderDeploymentsAuthCredentialsListOutput,
  DashboardInstanceProviderDeploymentsListOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useInstanceProviderAuthCredentials,
  useProviderDeployments,
  useProviders
} from '@metorial/state';
import { Badge, Input, RenderDate, Spacer, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useMemo, useState } from 'react';
import { useDebounced } from '../../../../../hooks/useDebounced';

type CredentialOverviewRow = {
  credential: DashboardInstanceProviderDeploymentsAuthCredentialsListOutput['items'][number];
  deployment: DashboardInstanceProviderDeploymentsListOutput['items'][number];
};

export let ProviderAuthCredentialsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  let deployments = useProviderDeployments(instance.data?.id, {
    limit: 100
  });

  let deploymentItems = deployments.data?.items ?? [];
  let providerIds = useMemo(
    () => [...new Set(deploymentItems.map(deployment => deployment.providerId).filter(Boolean))],
    [deploymentItems]
  );
  let authCredentials = useInstanceProviderAuthCredentials(
    instance.data?.id,
    providerIds.length > 0
      ? {
          providerId: providerIds,
          search: searchDebounced
        }
      : null
  );
  let providers = useProviders(
    instance.data?.id,
    providerIds.length > 0 ? { id: providerIds } : null
  );
  let providerNameMap = useMemo(() => {
    let map = new Map<string, string>();
    for (let provider of providers.data?.items ?? []) {
      if (provider.id && provider.name) map.set(provider.id, provider.name);
    }
    return map;
  }, [providers.data?.items]);
  let rows = useMemo(() => {
    let deploymentByProviderId = new Map<
      string,
      DashboardInstanceProviderDeploymentsListOutput['items'][number]
    >();
    for (let deployment of deploymentItems) {
      if (!deploymentByProviderId.has(deployment.providerId)) {
        deploymentByProviderId.set(deployment.providerId, deployment);
      }
    }

    let nextRows: CredentialOverviewRow[] = [];
    for (let credential of authCredentials.data?.items ?? []) {
      let deployment = deploymentByProviderId.get(credential.providerId);
      if (!deployment) continue;

      nextRows.push({
        credential,
        deployment
      });
    }

    return nextRows;
  }, [authCredentials.data?.items, deploymentItems]);

  return renderWithLoader({ organization, project, instance, deployments })(
    ({ organization, project, instance }) => (
      <>
        <Input
          label="Search"
          hideLabel
          placeholder="Search auth credentials..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <Spacer size={15} />

        {providerIds.length === 0 ? (
          <Text size="2" color="gray600">
            No auth credentials found.
          </Text>
        ) : (
          renderWithPagination(authCredentials, {
            emptyState: (
              <Text size="2" color="gray600">
                No auth credentials found.
              </Text>
            )
          })(() =>
            rows.length > 0 ? (
              <Table
                headers={['Name', 'Provider', 'Version', 'Created']}
                data={rows.map(row => ({
                  href: Paths.instance.providerAuthCredential(
                    organization.data,
                    project.data,
                    instance.data,
                    row.deployment.id,
                    row.credential.id
                  ),
                  data: [
                    <Text size="2" weight="strong">
                      {row.credential.name || '—'}
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
                    row.credential.createdAt ? (
                      <RenderDate date={row.credential.createdAt} />
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
                No auth credentials found.
              </Text>
            )
          )
        )}
      </>
    )
  );
};

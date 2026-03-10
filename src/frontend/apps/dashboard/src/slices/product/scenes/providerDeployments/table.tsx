import { DashboardInstanceProviderDeploymentsListQuery } from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderDeployments,
  useProviders
} from '@metorial/state';
import { Badge, RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useMemo } from 'react';

type ProviderDeploymentStatusFilter = Extract<
  DashboardInstanceProviderDeploymentsListQuery['status'],
  'active' | 'archived'
>;

let normalizeProviderDeploymentStatus = (
  status?: string
): ProviderDeploymentStatusFilter | undefined => {
  if (status === 'active' || status === 'archived') return status;
  return undefined;
};

export let ProviderDeploymentsTable = ({
  instanceId,
  providerId,
  status,
  search
}: {
  instanceId: string;
  providerId?: string;
  status?: string;
  search?: string;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let deployments = useProviderDeployments(instanceId, {
    providerId,
    status: normalizeProviderDeploymentStatus(status),
    search,
    order: 'desc'
  });
  let providerIds = useMemo(
    () => [...new Set((deployments.data?.items ?? []).map(deployment => deployment.providerId))],
    [deployments.data?.items]
  );
  let providers = useProviders(instanceId, { id: providerIds });
  let providerNameMap = useMemo(() => {
    let map = new Map<string, string>();
    for (let provider of providers.data?.items ?? []) {
      if (provider.id && provider.name) map.set(provider.id, provider.name);
    }
    return map;
  }, [providers.data?.items]);

  let deploymentsContent = renderWithPagination(deployments)(deployments => (
    <>
      <Table
        headers={['Name', 'Provider', 'Version', 'Created']}
        data={deployments.data.items.map(deployment => ({
          data: [
            <Text size="2" weight="strong">
              {deployment.name ?? <span style={{ color: theme.colors.gray600 }}>Unnamed</span>}
            </Text>,
            <Text size="2">
              {providerNameMap.get(deployment.providerId) ?? deployment.providerId}
            </Text>,
            deployment.lockedVersion ? (
              <Badge color="purple" size="1">
                {deployment.lockedVersion.version}
              </Badge>
            ) : (
              <Badge color="gray" size="1">
                Default
              </Badge>
            ),
            <RenderDate date={deployment.createdAt} />
          ],
          href: Paths.instance.providerDeployment(
            organization.data,
            project.data,
            instance.data,
            deployment.id
          )
        }))}
      />

      {deployments.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No deployments for this instance.
        </Text>
      )}
    </>
  ));

  return renderWithLoader({ providers })(() => deploymentsContent);
};

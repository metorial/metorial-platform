import { DashboardInstanceProviderDeploymentsListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
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
  let providers = useProviders(instanceId, { limit: 100 });
  let providerNameMap = useMemo(() => {
    let map = new Map<string, string>();
    for (let provider of providers.data?.items ?? []) {
      if (provider.id && provider.name) map.set(provider.id, provider.name);
    }
    return map;
  }, [providers.data?.items]);

  return renderWithPagination(deployments)(deployments => (
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
            organization.data as any,
            project.data as any,
            instance.data as any,
            deployment.id
          )
        }))}
      />

      {deployments.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No deployments found.
        </Text>
      )}
    </>
  ));
};

import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useInstanceProviderAuthConfigs,
  useProviderDeployments
} from '@metorial/state';
import { RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useEffect, useMemo } from 'react';

export let ProviderAuthConfigsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let authConfigs = useInstanceProviderAuthConfigs(instance.data?.id);
  let deployments = useProviderDeployments(instance.data?.id);

  useEffect(() => {
    let onCreated = () => authConfigs.refetch?.();
    window.addEventListener('provider-auth-config-created', onCreated);
    return () => window.removeEventListener('provider-auth-config-created', onCreated);
  }, [authConfigs.refetch]);

  let deploymentById = useMemo(() => {
    let map = new Map<string, { id: string; name: string | null }>();
    for (let d of deployments.data?.items ?? []) {
      map.set(d.id, { id: d.id, name: d.name });
    }
    return map;
  }, [deployments.data?.items]);

  let providerNameById = useMemo(() => {
    let map = new Map<string, string>();
    for (let d of deployments.data?.items ?? []) {
      if (d.provider?.name) map.set(d.providerId, d.provider.name);
    }
    return map;
  }, [deployments.data?.items]);

  return renderWithPagination(authConfigs)(authConfigs => (
    <>
      <Table
        headers={['Name', 'Type', 'Provider', 'Created']}
        data={authConfigs.data.items.map(config => {
          let deployment = config.providerDeploymentId
            ? deploymentById.get(config.providerDeploymentId)
            : undefined;

          return {
            href:
              deployment && config.providerDeploymentId
                ? Paths.instance.providerAuthConnection(
                    organization.data as any,
                    project.data as any,
                    instance.data as any,
                    config.providerDeploymentId,
                    config.id
                  )
                : undefined,
            data: [
              <Text size="2" weight="strong">
                {config.name ?? (
                  <span style={{ color: theme.colors.gray600 }}>Unnamed</span>
                )}
              </Text>,
              <Text size="2">{config.type}</Text>,
              <Text size="2">
                {providerNameById.get(config.providerId) ?? config.providerId}
              </Text>,
              <RenderDate date={config.createdAt} />
            ]
          };
        })}
      />

      {authConfigs.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No auth configs found.
        </Text>
      )}
    </>
  ));
};

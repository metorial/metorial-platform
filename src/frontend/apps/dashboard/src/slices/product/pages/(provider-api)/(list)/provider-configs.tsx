import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderDeployments,
  useProviders,
  withAuth
} from '@metorial/state';
import { Badge, Input, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useEffect, useMemo, useState } from 'react';
import { useDebounced } from '../../../../../hooks/useDebounced';

type DeploymentPreview = {
  id: string;
  name: string | null;
  providerId: string;
  provider?: { name: string } | null;
  lockedVersion?: { version: string } | null;
};

type ConfigOverviewRow = {
  key: string;
  deployment: DeploymentPreview;
  configName: string;
  description: string | null;
  createdAt: Date | string | null;
};

export let ProviderConfigsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  let deployments = useProviderDeployments(instance.data?.id, {
    search: searchDebounced
  });

  let [rows, setRows] = useState<ConfigOverviewRow[]>([]);
  let [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  let [error, setError] = useState<string | null>(null);
  let [reloadKey, setReloadKey] = useState(0);

  let deploymentItems = deployments.data?.items ?? [];
  let providerIds = useMemo(
    () => [...new Set(deploymentItems.map(deployment => deployment.providerId).filter(Boolean))],
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
  let deploymentSignature = useMemo(
    () => deploymentItems.map(deployment => deployment.id).join(','),
    [deploymentItems]
  );

  useEffect(() => {
    let onCreated = () => setReloadKey(key => key + 1);
    window.addEventListener('provider-config-created', onCreated);
    return () => window.removeEventListener('provider-config-created', onCreated);
  }, []);

  useEffect(() => {
    if (!instance.data) return;

    let isCanceled = false;

    let load = async () => {
      if (!deploymentItems.length) {
        setRows([]);
        setError(null);
        return;
      }

      setIsLoadingConfigs(true);
      setError(null);

      try {
        let deploymentIds = deploymentItems.map(d => d.id);

        let response = await withAuth(sdk =>
          sdk.providerDeployments.configs.list(instance.data!.id, {
            providerDeploymentId: deploymentIds
          })
        );

        if (isCanceled) return;

        let deploymentById = new Map<string, DeploymentPreview>();
        for (let d of deploymentItems) {
          deploymentById.set(d.id, d);
        }

        let nextRows: ConfigOverviewRow[] = [];
        for (let config of response.items ?? []) {
          let deployment =
            (config.deployment?.id ? deploymentById.get(config.deployment.id) : null) ??
            deploymentById.values().next().value;
          if (!deployment) continue;
          nextRows.push({
            key: config.id,
            deployment,
            configName: config.name ?? 'Unnamed',
            description: config.description ?? null,
            createdAt: config.createdAt ?? null
          });
        }

        setRows(nextRows);
      } catch (e: any) {
        if (!isCanceled) {
          setError(e?.data?.message || e?.message || 'Failed to load configurations.');
          setRows([]);
        }
      } finally {
        if (!isCanceled) {
          setIsLoadingConfigs(false);
        }
      }
    };

    load();

    return () => {
      isCanceled = true;
    };
  }, [instance.data?.id, deploymentSignature, reloadKey]);

  return renderWithLoader({ instance, deployments })(({ instance }) => (
    <>
      <Input
        label="Search"
        hideLabel
        placeholder="Search configs..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <Spacer size={15} />

      {isLoadingConfigs && (
        <Text size="2" color="gray600">
          Loading configuration overview...
        </Text>
      )}

      {error && (
        <Text size="2" color="red500">
          {error}
        </Text>
      )}

      {!isLoadingConfigs && rows.length > 0 && (
        <Table
          headers={['Config Name', 'Provider', 'Version', 'Created']}
          data={rows.map(row => ({
            href: Paths.instance.providerConfig(
              organization.data as any,
              project.data as any,
              instance.data as any,
              row.deployment.id,
              row.key
            ),
            data: [
              <Text size="2" weight="strong">
                {row.configName}
              </Text>,
              <Text size="2">
                {row.deployment.provider?.name ??
                  providerNameMap.get(row.deployment.providerId) ??
                  row.deployment.providerId}
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
      )}

      {!isLoadingConfigs && !error && rows.length === 0 && (
        <Text size="2" color="gray600">
          No configs found.
        </Text>
      )}
    </>
  ));
};

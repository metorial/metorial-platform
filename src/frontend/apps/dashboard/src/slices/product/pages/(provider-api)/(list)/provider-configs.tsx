import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderDeployments,
  withAuth
} from '@metorial/state';
import { Badge, Input, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useEffect, useMemo, useState } from 'react';
import { useDebounced } from '../../../../../hooks/useDebounced';

type ConfigOverviewRow = {
  key: string;
  deployment: any;
  configName: string;
  description: string | null;
  isEphemeral: boolean;
  createdAt: string | null;
};

let mapWithConcurrency = async <I, O>(
  items: I[],
  limit: number,
  worker: (item: I) => Promise<O>
) => {
  if (!items.length) return [] as O[];

  let results = new Array<O>(items.length);
  let next = 0;

  let run = async () => {
    while (true) {
      let current = next++;
      if (current >= items.length) return;
      results[current] = await worker(items[current]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));

  return results;
};

export let ProviderConfigsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  let deployments = useProviderDeployments(instance.data?.instanceId, {
    search: searchDebounced
  });

  let [rows, setRows] = useState<ConfigOverviewRow[]>([]);
  let [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  let [error, setError] = useState<string | null>(null);
  let [reloadKey, setReloadKey] = useState(0);

  let deploymentItems = deployments.data?.items ?? [];
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
        let perDeployment = await mapWithConcurrency(deploymentItems, 4, async deployment => {
          try {
            let response = await withAuth(sdk =>
              sdk.providerDeployments.configs.list(instance.data!.instanceId, deployment.id)
            );

            return {
              deployment,
              configs: response.items ?? [],
              failed: false
            };
          } catch {
            return {
              deployment,
              configs: [],
              failed: true
            };
          }
        });

        if (isCanceled) return;

        let nextRows: ConfigOverviewRow[] = [];

        let failedCount = 0;
        for (let item of perDeployment) {
          if (item.failed) failedCount++;
          for (let config of item.configs) {
            nextRows.push({
              key: config.id,
              deployment: item.deployment,
              configName: config.name ?? 'Unnamed',
              description: config.description ?? null,
              isEphemeral: config.isEphemeral ?? false,
              createdAt: config.createdAt ?? null
            });
          }
        }

        setRows(nextRows);
        if (failedCount > 0 && nextRows.length === 0) {
          setError('Failed to load configs for one or more deployments.');
        }
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
  }, [instance.data?.instanceId, deploymentSignature, reloadKey]);

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
        <Text size="2" color="red">
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
                {row.deployment.provider?.name ?? row.deployment.providerId}
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

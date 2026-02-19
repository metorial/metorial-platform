import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderDeployments,
  withAuth
} from '@metorial/state';
import { Badge, Button, Flex, Input, RenderDate, Spacer, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useEffect, useMemo, useState } from 'react';
import { useDebounced } from '../../../../../hooks/useDebounced';
import { showProviderSetupSessionModal } from '../../../scenes/providerDeployments/setupSessionModal';

type DeploymentPreview = {
  id: string;
  name: string | null;
  providerId: string;
  provider?: { name: string } | null;
  lockedVersion?: { version: string } | null;
};

type CredentialOverviewRow = {
  key: string;
  deployment: DeploymentPreview;
  name: string | null;
  createdAt: Date | string | null;
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

export let ProviderAuthCredentialsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  let deployments = useProviderDeployments(instance.data?.id, {
    search: searchDebounced
  });

  let [rows, setRows] = useState<CredentialOverviewRow[]>([]);
  let [isLoadingCredentials, setIsLoadingCredentials] = useState(false);
  let [error, setError] = useState<string | null>(null);
  let [reloadKey, setReloadKey] = useState(0);

  let deploymentItems = deployments.data?.items ?? [];
  let deploymentSignature = useMemo(
    () => deploymentItems.map(deployment => deployment.id).join(','),
    [deploymentItems]
  );

  useEffect(() => {
    let onCreated = () => setReloadKey(key => key + 1);
    window.addEventListener('provider-auth-config-created', onCreated);
    return () => window.removeEventListener('provider-auth-config-created', onCreated);
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

      setIsLoadingCredentials(true);
      setError(null);

      try {
        let perDeployment = await mapWithConcurrency(deploymentItems, 4, async deployment => {
          try {
            let response = await withAuth(sdk =>
              sdk.providerDeployments.authCredentials.list(instance.data!.id, deployment.id)
            );

            return {
              deployment,
              credentials: response.items ?? [],
              failed: false
            };
          } catch {
            return {
              deployment,
              credentials: [],
              failed: true
            };
          }
        });

        if (isCanceled) return;

        let nextRows: CredentialOverviewRow[] = [];

        let failedCount = 0;
        for (let item of perDeployment) {
          if (item.failed) failedCount++;
          for (let cred of item.credentials) {
            nextRows.push({
              key: cred.id,
              deployment: item.deployment,
              name: cred.name ?? null,
              createdAt: cred.createdAt ?? null
            });
          }
        }

        setRows(nextRows);
        if (failedCount > 0 && nextRows.length === 0) {
          setError('Failed to load auth credentials for one or more deployments.');
        }
      } catch (e: any) {
        if (!isCanceled) {
          setError(e?.data?.message || e?.message || 'Failed to load auth credentials.');
          setRows([]);
        }
      } finally {
        if (!isCanceled) {
          setIsLoadingCredentials(false);
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
        placeholder="Search auth credentials..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <Spacer size={15} />

      {isLoadingCredentials && (
        <Text size="2" color="gray600">
          Loading auth credentials...
        </Text>
      )}

      {error && (
        <Text size="2" color="red500">
          {error}
        </Text>
      )}

      {!isLoadingCredentials && rows.length > 0 && (
        <Table
          headers={['Name', 'Provider', 'Version', 'Created']}
          data={rows.map(row => ({
            href: Paths.instance.providerAuthCredential(
              organization.data as any,
              project.data as any,
              instance.data as any,
              row.deployment.id,
              row.key
            ),
            data: [
              <Text size="2" weight="strong">
                {row.name || '—'}
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

      {!isLoadingCredentials && !error && rows.length === 0 && (
        <Text size="2" color="gray600">
          No auth credentials found.
        </Text>
      )}
    </>
  ));
};

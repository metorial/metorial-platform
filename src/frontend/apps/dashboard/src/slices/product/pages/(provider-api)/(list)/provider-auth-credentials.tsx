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
import { Badge, Input, RenderDate, Spacer, Text } from '@metorial/ui';
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

type CredentialOverviewRow = {
  key: string;
  deployment: DeploymentPreview;
  name: string | null;
  createdAt: Date | string | null;
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
      if (provider.id && provider.name) map.set(provider.id, provider.name);
    }
    return map;
  }, [providers.data?.items]);
  let deploymentSignature = useMemo(
    () => deploymentItems.map(deployment => deployment.id).join(','),
    [deploymentItems]
  );

  useEffect(() => {
    let onCreated = () => setReloadKey(key => key + 1);
    window.addEventListener('provider-auth-credentials-created', onCreated);
    return () =>
      window.removeEventListener('provider-auth-credentials-created', onCreated);
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
        let uniqueProviderIds = [
          ...new Set(deploymentItems.map(d => d.providerId))
        ];

        let response = await withAuth(sdk =>
          sdk.providerDeployments.authCredentials.list(instance.data!.id, {
            providerId: uniqueProviderIds
          })
        );

        if (isCanceled) return;

        let deploymentByProviderId = new Map<string, DeploymentPreview>();
        for (let d of deploymentItems) {
          if (!deploymentByProviderId.has(d.providerId)) {
            deploymentByProviderId.set(d.providerId, d);
          }
        }

        let nextRows: CredentialOverviewRow[] = [];
        for (let cred of response.items ?? []) {
          let deployment = deploymentByProviderId.get(cred.providerId);
          if (!deployment) continue;
          nextRows.push({
            key: cred.id,
            deployment,
            name: cred.name ?? null,
            createdAt: cred.createdAt ?? null
          });
        }

        setRows(nextRows);
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

      {!isLoadingCredentials && !error && rows.length === 0 && (
        <Text size="2" color="gray600">
          No auth credentials found.
        </Text>
      )}
    </>
  ));
};

import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviders,
  withAuth
} from '@metorial/state';
import { Input, RenderDate, Spacer, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useEffect, useMemo, useState } from 'react';
import { useDebounced } from '../../../../../hooks/useDebounced';

type AuthConnectionRow = {
  key: string;
  name: string | null;
  type: string | null;
  providerId: string;
  providerName: string | null;
  providerDeploymentId: string | null;
  createdAt: string | null;
};

let formatType = (type: string | null | undefined) => {
  if (type === 'oauth_automated') return 'OAuth (Automated)';
  if (type === 'oauth_manual') return 'OAuth (Manual)';
  if (type === 'manual') return 'Manual';
  return '\u2014';
};

export let ProviderAuthConnectionsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  let [rows, setRows] = useState<AuthConnectionRow[]>([]);
  let [isLoading, setIsLoading] = useState(false);
  let [error, setError] = useState<string | null>(null);
  let [reloadKey, setReloadKey] = useState(0);
  let providers = useProviders(instance.data?.id, { limit: 100 });
  let providerNameMap = useMemo(() => {
    let map = new Map<string, string>();
    for (let provider of providers.data?.items ?? []) {
      if (provider.id && provider.name) map.set(provider.id, provider.name);
    }
    return map;
  }, [providers.data?.items]);

  useEffect(() => {
    let onCreated = () => setReloadKey(key => key + 1);
    window.addEventListener('provider-auth-config-created', onCreated);
    return () => window.removeEventListener('provider-auth-config-created', onCreated);
  }, []);

  useEffect(() => {
    if (!instance.data) return;

    let isCanceled = false;

    let load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let response = await withAuth(sdk =>
          sdk.providers.authConfigs.list(instance.data!.id)
        );

        if (isCanceled) return;

        let items = (response?.items ?? []) as any[];

        let nextRows: AuthConnectionRow[] = items
          .filter((config: any) => {
            if (!searchDebounced.trim()) return true;
            let q = searchDebounced.toLowerCase();
            let providerId = config.providerId ?? '';
            let providerName = providerNameMap.get(providerId) ?? '';
            return (
              (config.name ?? '').toLowerCase().includes(q) ||
              (config.type ?? '').toLowerCase().includes(q) ||
              providerId.toLowerCase().includes(q) ||
              providerName.toLowerCase().includes(q)
            );
          })
          .map((config: any) => ({
            key: config.id,
            name: config.name ?? null,
            type: config.type ?? null,
            providerId: config.providerId ?? '',
            providerName: providerNameMap.get(config.providerId ?? '') ?? null,
            providerDeploymentId: config.providerDeploymentId ?? null,
            createdAt: config.createdAt ?? null
          }));

        setRows(nextRows);
      } catch (e: any) {
        if (!isCanceled) {
          setError(e?.data?.message || e?.message || 'Failed to load auth connections.');
          setRows([]);
        }
      } finally {
        if (!isCanceled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isCanceled = true;
    };
  }, [instance.data?.id, providerNameMap, reloadKey, searchDebounced]);

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Input
        label="Search"
        hideLabel
        placeholder="Search auth connections..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <Spacer size={15} />

      {isLoading && (
        <Text size="2" color="gray600">
          Loading auth connections...
        </Text>
      )}

      {error && (
        <Text size="2" color="red500">
          {error}
        </Text>
      )}

      {!isLoading && rows.length > 0 && (
        <Table
          headers={['Name', 'Type', 'Provider', 'Created']}
          data={rows.map(row => ({
            href: row.providerDeploymentId
              ? Paths.instance.providerAuthConnection(
                  organization.data as any,
                  project.data as any,
                  instance.data as any,
                  row.providerDeploymentId,
                  row.key
                )
              : undefined,
            data: [
              <Text size="2" weight="strong">
                {row.name || '\u2014'}
              </Text>,
              <Text size="2">{formatType(row.type)}</Text>,
              <Text size="2">{row.providerName ?? row.providerId}</Text>,
              row.createdAt ? (
                <RenderDate date={row.createdAt} />
              ) : (
                <Text size="2" color="gray600">
                  {'\u2014'}
                </Text>
              )
            ]
          }))}
        />
      )}

      {!isLoading && !error && rows.length === 0 && (
        <Text size="2" color="gray600">
          No auth connections found. Complete an OAuth flow from the Explorer to create one.
        </Text>
      )}
    </>
  ));
};

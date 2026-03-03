import { DashboardInstanceProviderDeploymentsConfigVaultsListOutput } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderConfigVaults,
  useProviders
} from '@metorial/state';
import { Input, RenderDate, Spacer, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useMemo, useState } from 'react';
import { useDebounced } from '../../../../../hooks/useDebounced';

export let ProviderConfigVaultsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  let vaults = useProviderConfigVaults(instance.data?.id, {
    search: searchDebounced
  });
  let providerIds = useMemo(
    () => [...new Set((vaults.data?.items ?? []).map(vault => vault.providerId).filter(Boolean))],
    [vaults.data?.items]
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
  return (
    <>
      <Input
        label="Search"
        hideLabel
        placeholder="Search config vaults..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <Spacer size={15} />

      {renderWithPagination(vaults)(vaults => (
        <>
          {vaults.data.items.length > 0 && (
            <Table
              headers={['Name', 'Provider', 'Deployment', 'Created']}
              data={vaults.data.items.map(
                (vault: DashboardInstanceProviderDeploymentsConfigVaultsListOutput['items'][number]) => ({
                  href: Paths.instance.providerConfigVault(
                    organization.data,
                    project.data,
                    instance.data,
                    vault.id
                  ),
                  data: [
                    <Text size="2" weight="strong">
                      {vault.name ?? 'Unnamed Vault'}
                    </Text>,
                    <Text size="2">
                      {providerNameMap.get(vault.providerId) ?? vault.providerId ?? '—'}
                    </Text>,
                    <Text size="2">{vault.deployment?.name ?? '—'}</Text>,
                    vault.createdAt ? (
                      <RenderDate date={vault.createdAt} />
                    ) : (
                      <Text size="2" color="gray600">
                        —
                      </Text>
                    )
                  ]
                })
              )}
            />
          )}

          {vaults.data.items.length === 0 && (
            <Text size="2" color="gray600">
              No config vaults found.
            </Text>
          )}
        </>
      ))}
    </>
  );
};

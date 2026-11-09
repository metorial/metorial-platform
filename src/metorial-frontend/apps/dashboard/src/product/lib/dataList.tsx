import type { DataListEnrichResult } from '@metorial/data-list';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviders
} from '@metorial/state';
import { useMemo } from 'react';

export let useInstanceContext = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();

  return {
    organization: organization.data,
    project: project.data,
    instance: instance.data,
    instanceId: instance.data?.id
  };
};

export type InstanceContext = ReturnType<typeof useInstanceContext>;

export type WithProviderName<Row> = Row & { providerName?: string | null };

export let withProviderNames =
  <Row extends { id: string }>(getProviderId: (row: Row) => string | null | undefined) =>
  (
    items: Row[],
    { ctx }: { ctx: { instanceId?: string } }
  ): DataListEnrichResult<WithProviderName<Row>> => {
    let providerIds = useMemo(
      () => [...new Set(items.map(getProviderId).filter((id): id is string => !!id))],
      [items]
    );

    let shouldLoad = providerIds.length > 0;
    let providers = useProviders(ctx.instanceId, shouldLoad ? { id: providerIds } : null);

    let names = useMemo(() => {
      let map = new Map<string, string>();

      for (let provider of providers.data?.items ?? []) {
        if (provider.id && provider.name) map.set(provider.id, provider.name);
      }

      return map;
    }, [providers.data?.items]);

    let enriched = useMemo(
      () =>
        items.map(row => {
          let providerId = getProviderId(row);
          return { ...row, providerName: providerId ? (names.get(providerId) ?? null) : null };
        }),
      [items, names]
    );

    return {
      items: enriched,
      isLoading: shouldLoad && providers.isLoading,
      error: shouldLoad ? providers.error : null
    };
  };

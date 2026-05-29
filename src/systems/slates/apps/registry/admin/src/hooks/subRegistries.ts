import { createLoader } from '@metorial/data-hooks';
import { useMemo, useState } from 'react';
import { adminClient, withAuthRedirect } from './client';

export let subRegistriesLoader = createLoader({
  name: 'subRegistries',
  fetch: (params: { tenantId: string; after?: string; before?: string }) =>
    withAuthRedirect(() => adminClient.subRegistry.list(params)),
  hash: params => `${params.tenantId}:${params.after ?? ''}:${params.before ?? ''}`,
  mutators: {}
});

export let useSubRegistries = (tenantId: string | undefined) => {
  let [cursor, setCursor] = useState<{ after?: string; before?: string }>({});

  let loader = subRegistriesLoader.use(tenantId ? { tenantId, ...cursor } : null);

  let transformedData = useMemo(() => {
    if (!loader.data) return null;
    return {
      ...loader.data,
      pagination: {
        hasMoreAfter: loader.data.pagination.has_more_after,
        hasMoreBefore: loader.data.pagination.has_more_before
      }
    };
  }, [loader.data]);

  return {
    ...loader,
    data: transformedData,
    next: () => {
      let items = loader.data?.items;
      if (items?.length) {
        setCursor({ after: items[items.length - 1].id });
      }
    },
    previous: () => {
      let items = loader.data?.items;
      if (items?.length) {
        setCursor({ before: items[0].id });
      }
    }
  };
};

export let subRegistryLoader = createLoader({
  name: 'subRegistry',
  fetch: (params: { tenantId: string; subRegistryId: string }) =>
    withAuthRedirect(() => adminClient.subRegistry.get(params)),
  hash: params => `${params.tenantId}:${params.subRegistryId}`,
  mutators: {},
  parents: [subRegistriesLoader]
});

export let useSubRegistry = (tenantId: string | undefined, subRegistryId: string) =>
  subRegistryLoader.use(tenantId && subRegistryId ? { tenantId, subRegistryId } : null);

export let useCreateSubRegistry = subRegistriesLoader.createExternalMutator(
  (data: { tenantId: string; name: string; identifier: string }) =>
    withAuthRedirect(() => adminClient.subRegistry.create(data))
);

export let useSetSubRegistryFilters = subRegistryLoader.createExternalMutator(
  (data: {
    tenantId: string;
    subRegistryId: string;
    filters: Array<{ type: 'scope' | 'prefix' | 'package'; value: string }>;
  }) => withAuthRedirect(() => adminClient.subRegistry.setFilters(data))
);

export let useAddSubRegistryFilter = subRegistryLoader.createExternalMutator(
  (data: {
    tenantId: string;
    subRegistryId: string;
    type: 'scope' | 'prefix' | 'package';
    value: string;
  }) => withAuthRedirect(() => adminClient.subRegistry.addFilter(data))
);

export let useRemoveSubRegistryFilter = subRegistryLoader.createExternalMutator(
  (data: { tenantId: string; subRegistryId: string; filterId: string }) =>
    withAuthRedirect(() => adminClient.subRegistry.removeFilter(data))
);

import { createLoader } from '@metorial/data-hooks';
import { useMemo, useState } from 'react';
import { adminClient, withAuthRedirect } from './client';

export let tenantsLoader = createLoader({
  name: 'tenants',
  fetch: (params: { after?: string; before?: string }) =>
    withAuthRedirect(() => adminClient.tenant.list(params)),
  hash: params => `${params.after ?? ''}:${params.before ?? ''}`,
  mutators: {}
});

export let useTenants = () => {
  let [cursor, setCursor] = useState<{ after?: string; before?: string }>({});

  let loader = tenantsLoader.use(cursor);

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

export let tenantLoader = createLoader({
  name: 'tenant',
  fetch: (tenantId: string) => withAuthRedirect(() => adminClient.tenant.get({ tenantId })),
  hash: tenantId => tenantId,
  mutators: {},
  parents: [tenantsLoader]
});

export let useTenant = (tenantId: string) => tenantLoader.use(tenantId || null);

export let useCreateTenant = tenantsLoader.createExternalMutator(
  (data: { name: string; identifier: string }) =>
    withAuthRedirect(() => adminClient.tenant.upsert(data))
);

export let useUpdateTenant = tenantsLoader.createExternalMutator(
  (data: { tenantId: string; name?: string }) =>
    withAuthRedirect(() => adminClient.tenant.update(data))
);

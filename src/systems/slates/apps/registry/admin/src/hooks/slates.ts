import { createLoader } from '@metorial/data-hooks';
import { useEffect, useMemo, useState } from 'react';
import { adminClient, withAuthRedirect } from './client';

export let slatesLoader = createLoader({
  name: 'slates',
  fetch: (params: { tenantId: string; after?: string; before?: string; search?: string }) =>
    withAuthRedirect(() => adminClient.slate.list(params)),
  hash: params =>
    `${params.tenantId}:${params.after ?? ''}:${params.before ?? ''}:${params.search ?? ''}`,
  mutators: {}
});

export let useSlates = (tenantId: string | undefined, search?: string) => {
  let [cursor, setCursor] = useState<{ after?: string; before?: string }>({});
  let serializedParams = JSON.stringify({ tenantId, search });

  useEffect(() => {
    setCursor(currentCursor =>
      currentCursor.after || currentCursor.before ? {} : currentCursor
    );
  }, [serializedParams]);

  let loader = slatesLoader.use(tenantId ? { tenantId, search, ...cursor } : null);

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

export let slateLoader = createLoader({
  name: 'slate',
  fetch: (params: { tenantId: string; slateId: string }) =>
    withAuthRedirect(() => adminClient.slate.get(params)),
  hash: params => `${params.tenantId}:${params.slateId}`,
  mutators: {},
  parents: [slatesLoader]
});

export let useSlate = (tenantId: string | undefined, slateId: string) =>
  slateLoader.use(tenantId && slateId ? { tenantId, slateId } : null);

export let slateVersionsLoader = createLoader({
  name: 'slateVersions',
  fetch: (params: { tenantId: string; slateId: string; after?: string; before?: string }) =>
    withAuthRedirect(() => adminClient.slate.version.list(params)),
  hash: params =>
    `${params.tenantId}:${params.slateId}:${params.after ?? ''}:${params.before ?? ''}`,
  mutators: {},
  parents: [slateLoader]
});

export let useSlateVersions = (tenantId: string | undefined, slateId: string) => {
  let [cursor, setCursor] = useState<{ after?: string; before?: string }>({});

  let loader = slateVersionsLoader.use(
    tenantId && slateId ? { tenantId, slateId, ...cursor } : null
  );

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

export let usePublishSlate = slatesLoader.createExternalMutator(
  (data: {
    tenantId: string;
    slateId: string;
    scopeIdentifier: string;
    slateIdentifier: string;
    contentBase64: string;
    access: 'public' | 'private';
  }) => withAuthRedirect(() => adminClient.slate.version.create(data))
);

export let usePublishNewSlate = slatesLoader.createExternalMutator(
  (data: {
    tenantId: string;
    scopeIdentifier?: string;
    slateIdentifier?: string;
    contentBase64: string;
    access: 'public' | 'private';
  }) => withAuthRedirect(() => adminClient.slate.version.create({ ...data }))
);

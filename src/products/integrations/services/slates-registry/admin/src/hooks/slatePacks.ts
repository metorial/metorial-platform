import { createLoader } from '@metorial-io/data-hooks';
import { useMemo, useState } from 'react';
import { adminClient, withAuthRedirect } from './client';

export let slatePackOverviewLoader = createLoader({
  name: 'slatePackOverview',
  fetch: (params: { tenantId: string }) =>
    withAuthRedirect(() => adminClient.slatePack.overview(params)),
  hash: params => params.tenantId,
  mutators: {}
});

export let useSlatePackOverview = (tenantId: string | undefined) =>
  slatePackOverviewLoader.use(tenantId ? { tenantId } : null);

export let useForceFullSync = slatePackOverviewLoader.createExternalMutator(
  (data: { tenantId: string; subRegistryIdentifier: string; reset: boolean; rewindFeed: boolean }) =>
    withAuthRedirect(() => adminClient.slatePack.forceFullSync(data))
);

export let slatePackReleasesLoader = createLoader({
  name: 'slatePackReleases',
  fetch: (params: {
    tenantId: string;
    subRegistryIdentifier: string;
    status?: 'ready' | 'pruned';
    after?: string;
    before?: string;
  }) => withAuthRedirect(() => adminClient.slatePack.listReleases(params)),
  hash: params =>
    `${params.tenantId}:${params.subRegistryIdentifier}:${params.status ?? ''}:${params.after ?? ''}:${params.before ?? ''}`,
  mutators: {}
});

export let useSlatePackReleases = (d: {
  tenantId: string | undefined;
  subRegistryIdentifier: string;
  status: 'ready' | 'pruned';
}) => {
  let [cursor, setCursor] = useState<{ after?: string; before?: string }>({});

  let loader = slatePackReleasesLoader.use(
    d.tenantId
      ? {
          tenantId: d.tenantId,
          subRegistryIdentifier: d.subRegistryIdentifier,
          status: d.status,
          ...cursor
        }
      : null
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
    resetCursor: () => setCursor({}),
    next: () => {
      let items = loader.data?.items;
      if (items?.length) setCursor({ after: items[items.length - 1].id });
    },
    previous: () => {
      let items = loader.data?.items;
      if (items?.length) setCursor({ before: items[0].id });
    }
  };
};

export let slatePackBuildsLoader = createLoader({
  name: 'slatePackBuilds',
  fetch: (params: {
    tenantId: string;
    subRegistryIdentifier: string;
    after?: string;
    before?: string;
  }) => withAuthRedirect(() => adminClient.slatePack.listBuilds(params)),
  hash: params =>
    `${params.tenantId}:${params.subRegistryIdentifier}:${params.after ?? ''}:${params.before ?? ''}`,
  mutators: {}
});

export let useSlatePackBuilds = (d: {
  tenantId: string | undefined;
  subRegistryIdentifier: string;
}) => {
  let [cursor, setCursor] = useState<{ after?: string; before?: string }>({});

  let loader = slatePackBuildsLoader.use(
    d.tenantId
      ? { tenantId: d.tenantId, subRegistryIdentifier: d.subRegistryIdentifier, ...cursor }
      : null
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
      if (items?.length) setCursor({ after: items[items.length - 1].id });
    },
    previous: () => {
      let items = loader.data?.items;
      if (items?.length) setCursor({ before: items[0].id });
    }
  };
};

export let slatePackBuildLoader = createLoader({
  name: 'slatePackBuild',
  fetch: (params: { tenantId: string; subRegistryIdentifier: string; buildId: string }) =>
    withAuthRedirect(() => adminClient.slatePack.getBuild(params)),
  hash: params => `${params.tenantId}:${params.subRegistryIdentifier}:${params.buildId}`,
  mutators: {}
});

export let useSlatePackBuild = (d: {
  tenantId: string | undefined;
  subRegistryIdentifier: string;
  buildId: string | null;
}) =>
  slatePackBuildLoader.use(
    d.tenantId && d.buildId
      ? {
          tenantId: d.tenantId,
          subRegistryIdentifier: d.subRegistryIdentifier,
          buildId: d.buildId
        }
      : null
  );

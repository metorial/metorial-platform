import type {
  DashboardInstanceSandboxRegionsListQuery,
  DashboardInstanceSandboxSpecsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { withAuth } from '../../user';

let CATALOG_PAGE_SIZE = 100;

export let sandboxSpecsLoader = createLoader({
  name: 'sandboxSpecs',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSandboxSpecsListQuery) =>
    withAuth(async sdk => {
      let { instanceId, ...query } = i;
      let items = await autoPaginate(cursor =>
        sdk.sandbox.specs.list(instanceId, { ...query, ...cursor })
      );

      return { items, pagination: { hasMoreBefore: false, hasMoreAfter: false } };
    }),
  mutators: {}
});

export let useSandboxSpecs = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSandboxSpecsListQuery | null
) =>
  sandboxSpecsLoader.use(
    instanceId && query !== null
      ? { instanceId, limit: CATALOG_PAGE_SIZE, ...(query ?? {}) }
      : null
  );

export let sandboxRegionsLoader = createLoader({
  name: 'sandboxRegions',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSandboxRegionsListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.sandbox.regions.list(instanceId, query);
    }),
  mutators: {}
});

export let useSandboxRegions = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSandboxRegionsListQuery | null
) =>
  sandboxRegionsLoader.use(
    instanceId && query !== null
      ? { instanceId, limit: CATALOG_PAGE_SIZE, ...(query ?? {}) }
      : null
  );

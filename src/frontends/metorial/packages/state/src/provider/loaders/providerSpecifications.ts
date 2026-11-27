import type {
  DashboardInstanceProvidersSpecificationsGetOutput,
  DashboardInstanceProvidersSpecificationsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerSpecificationsLoader = createLoader({
  name: 'providerSpecifications',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceProvidersSpecificationsListQuery) =>
    withAuth(sdk => sdk.providers.specifications.list(i.instanceId, i)),
  mutators: {}
});

export let useProviderSpecifications = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceProvidersSpecificationsListQuery | null
) => {
  let data = usePaginator(pagination =>
    providerSpecificationsLoader.use(
      instanceId ? { ...pagination, ...query, instanceId } : null
    )
  );

  return data;
};

export let providerSpecificationLoader = createLoader({
  name: 'providerSpecification',
  parents: [providerSpecificationsLoader],
  fetch: (i: { instanceId: string; providerSpecificationId: string }) =>
    withAuth(sdk => sdk.providers.specifications.get(i.instanceId, i.providerSpecificationId)),
  mutators: {}
});

export let useProviderSpecification = (
  instanceId: string | null | undefined,
  providerSpecificationId: string | null | undefined
) => {
  let data = providerSpecificationLoader.use(
    instanceId && providerSpecificationId ? { instanceId, providerSpecificationId } : null
  );

  return data;
};

type ProviderToolCategory =
  DashboardInstanceProvidersSpecificationsGetOutput['toolCategories'][number];

type CategorizedTool = { specificationId: string; toolCategoryKeys: string[] };

let getCategorizedSpecificationIds = (tools: CategorizedTool[]) =>
  Array.from(
    new Set(
      tools.filter(tool => tool.toolCategoryKeys.length > 0).map(tool => tool.specificationId)
    )
  ).sort();

export let providerToolCategoriesLoader = createLoader({
  name: 'providerToolCategories',
  parents: [providerSpecificationsLoader],
  fetch: (i: { instanceId: string; providerSpecificationIds: string[] }) =>
    withAuth(async sdk => {
      let entries = await Promise.all(
        i.providerSpecificationIds.map(async providerSpecificationId => {
          let specification = await sdk.providers.specifications.get(
            i.instanceId,
            providerSpecificationId
          );

          return [providerSpecificationId, specification.toolCategories] as const;
        })
      );

      return Object.fromEntries(entries) as Record<string, ProviderToolCategory[]>;
    }),
  mutators: {}
});

/**
 * Tool category definitions for the specifications of `tools` that use categories, kept per
 * specification so `getCategories` only returns the ones belonging to the given tools.
 * `getCategories` returns `null` until the definitions load (or when they fail to), in which
 * case editors name categories after their keys.
 */
export let useProviderToolCategories = (
  instanceId: string | null | undefined,
  tools: CategorizedTool[] | null | undefined
) => {
  let specificationIds = getCategorizedSpecificationIds(tools ?? []);
  let input =
    instanceId && specificationIds.length
      ? { instanceId, providerSpecificationIds: specificationIds }
      : null;
  let categories = providerToolCategoriesLoader.use(input);

  return {
    isLoading: !!input && categories.isLoading,
    error: categories.error,
    getCategories: (forTools: CategorizedTool[]) => {
      let data = categories.data;
      if (!data) return null;

      return getCategorizedSpecificationIds(forTools).flatMap(id => data[id] ?? []);
    }
  };
};

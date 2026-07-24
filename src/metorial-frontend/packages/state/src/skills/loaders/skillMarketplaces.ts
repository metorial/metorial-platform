import type {
  DashboardInstanceSkillsMarketplacesCreateBody,
  DashboardInstanceSkillsMarketplacesGetEditorUrlOutput,
  DashboardInstanceSkillsMarketplacesGetOutput,
  DashboardInstanceSkillsMarketplacesListQuery,
  DashboardInstanceSkillsMarketplacesPluginsAddBody,
  DashboardInstanceSkillsMarketplacesPluginsGetOutput,
  DashboardInstanceSkillsMarketplacesPluginsListQuery,
  DashboardInstanceSkillsMarketplacesRepositoriesCreateBody,
  DashboardInstanceSkillsMarketplacesRepositoriesGetOutput,
  DashboardInstanceSkillsMarketplacesRepositoriesListQuery,
  DashboardInstanceSkillsMarketplacesUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { useEffect } from 'react';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { skillSyncLoader, skillSyncsLoader } from './skillSyncs';

export type SkillMarketplace = DashboardInstanceSkillsMarketplacesGetOutput;
export type SkillMarketplacePlugin = DashboardInstanceSkillsMarketplacesPluginsGetOutput;
export type SkillMarketplaceRepository =
  DashboardInstanceSkillsMarketplacesRepositoriesGetOutput;
export type SkillMarketplaceEditorUrl = DashboardInstanceSkillsMarketplacesGetEditorUrlOutput;

let toArrayIfString = <T extends string>(value: T | T[] | undefined) =>
  typeof value === 'string' ? [value] : value;

let normalizeSkillMarketplacesListQuery = (
  query: DashboardInstanceSkillsMarketplacesListQuery
): DashboardInstanceSkillsMarketplacesListQuery => ({
  ...query,
  id: toArrayIfString(query.id),
  status: toArrayIfString(query.status),
  skillConfigurationId: toArrayIfString(query.skillConfigurationId)
});

let normalizeSkillMarketplacePluginsListQuery = (
  query: DashboardInstanceSkillsMarketplacesPluginsListQuery
): DashboardInstanceSkillsMarketplacesPluginsListQuery => ({
  ...query,
  id: toArrayIfString(query.id),
  status: toArrayIfString(query.status),
  skillPluginId: toArrayIfString(query.skillPluginId),
  skillConfigurationId: toArrayIfString(query.skillConfigurationId)
});

export let skillMarketplacesLoader = createLoader({
  name: 'skillMarketplaces',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSkillsMarketplacesListQuery) =>
    withAuth(sdk =>
      sdk.skillMarketplaces.list(i.instanceId, normalizeSkillMarketplacesListQuery(i))
    ),
  mutators: {}
});

export let useCreateSkillMarketplace = skillMarketplacesLoader.createExternalMutator(
  (i: DashboardInstanceSkillsMarketplacesCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.skillMarketplaces.create(i.instanceId, i))
);

export let useSkillMarketplaces = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSkillsMarketplacesListQuery | null
) => {
  return usePaginator(
    pagination =>
      skillMarketplacesLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    instanceId ? `${instanceId}:skillMarketplaces:${JSON.stringify(query ?? {})}` : null
  );
};

export let skillMarketplaceLoader = createLoader({
  name: 'skillMarketplace',
  parents: [skillMarketplacesLoader],
  fetch: (i: { instanceId: string; skillMarketplaceId: string }) =>
    withAuth(sdk => sdk.skillMarketplaces.get(i.instanceId, i.skillMarketplaceId)),
  mutators: {
    update: (
      i: DashboardInstanceSkillsMarketplacesUpdateBody,
      {
        input: { instanceId, skillMarketplaceId }
      }: { input: { instanceId: string; skillMarketplaceId: string } }
    ) => withAuth(sdk => sdk.skillMarketplaces.update(instanceId, skillMarketplaceId, i)),

    delete: (
      _: void,
      {
        input: { instanceId, skillMarketplaceId }
      }: { input: { instanceId: string; skillMarketplaceId: string } }
    ) => withAuth(sdk => sdk.skillMarketplaces.archive(instanceId, skillMarketplaceId)),

    sync: (
      _: {},
      {
        input: { instanceId, skillMarketplaceId }
      }: { input: { instanceId: string; skillMarketplaceId: string } }
    ) =>
      withAuth(async sdk => {
        let res = await sdk.skillMarketplaces.sync(instanceId, skillMarketplaceId, {});

        skillSyncsLoader.refetchAll();
        skillSyncLoader.refetchAll();

        return res;
      })
  }
});

export let useSkillMarketplace = (
  instanceId: string | null | undefined,
  skillMarketplaceId: string | null | undefined
) => {
  let data = skillMarketplaceLoader.use(
    instanceId && skillMarketplaceId ? { instanceId, skillMarketplaceId } : null
  );

  return {
    ...data,
    updateMutator: data.useMutator('update'),
    deleteMutator: data.useMutator('delete'),
    syncMutator: data.useMutator('sync')
  };
};

export let skillMarketplacePluginsLoader = createLoader({
  name: 'skillMarketplacePlugins',
  parents: [skillMarketplaceLoader, skillMarketplacesLoader],
  fetch: (
    i: {
      instanceId: string;
      skillMarketplaceId: string;
    } & DashboardInstanceSkillsMarketplacesPluginsListQuery
  ) =>
    withAuth(sdk =>
      sdk.skillMarketplaces.plugins.list(
        i.instanceId,
        i.skillMarketplaceId,
        normalizeSkillMarketplacePluginsListQuery(i)
      )
    ),
  mutators: {}
});

export let useCreateSkillMarketplacePlugin =
  skillMarketplacePluginsLoader.createExternalMutator(
    (
      i: DashboardInstanceSkillsMarketplacesPluginsAddBody & {
        instanceId: string;
        skillMarketplaceId: string;
      }
    ) =>
      withAuth(sdk => sdk.skillMarketplaces.plugins.add(i.instanceId, i.skillMarketplaceId, i))
  );

export let useDeleteSkillMarketplacePlugin =
  skillMarketplacePluginsLoader.createExternalMutator(
    (i: {
      instanceId: string;
      skillMarketplaceId: string;
      skillMarketplacePluginId: string;
    }) =>
      withAuth(sdk =>
        sdk.skillMarketplaces.plugins.remove(
          i.instanceId,
          i.skillMarketplaceId,
          i.skillMarketplacePluginId
        )
      )
  );

export let useSkillMarketplacePlugins = (
  instanceId: string | null | undefined,
  skillMarketplaceId: string | null | undefined,
  query?: DashboardInstanceSkillsMarketplacesPluginsListQuery | null
) => {
  return usePaginator(
    pagination =>
      skillMarketplacePluginsLoader.use(
        instanceId && skillMarketplaceId && query !== null
          ? { instanceId, skillMarketplaceId, ...pagination, ...(query ?? {}) }
          : null
      ),
    instanceId && skillMarketplaceId
      ? `${instanceId}:${skillMarketplaceId}:marketplacePlugins:${JSON.stringify(query ?? {})}`
      : null
  );
};

export let skillMarketplaceRepositoriesLoader = createLoader({
  name: 'skillMarketplaceRepositories',
  parents: [skillMarketplaceLoader, skillMarketplacesLoader],
  fetch: (
    i: {
      instanceId: string;
      skillMarketplaceId: string;
    } & DashboardInstanceSkillsMarketplacesRepositoriesListQuery
  ) =>
    withAuth(sdk =>
      sdk.skillMarketplaces.repositories.list(i.instanceId, i.skillMarketplaceId, i)
    ),
  mutators: {}
});

export let useCreateSkillMarketplaceRepository =
  skillMarketplaceRepositoriesLoader.createExternalMutator(
    (
      i: DashboardInstanceSkillsMarketplacesRepositoriesCreateBody & {
        instanceId: string;
        skillMarketplaceId: string;
      }
    ) =>
      withAuth(sdk =>
        sdk.skillMarketplaces.repositories.create(i.instanceId, i.skillMarketplaceId, i)
      )
  );

export let useDeleteSkillMarketplaceRepository =
  skillMarketplaceRepositoriesLoader.createExternalMutator(
    (i: {
      instanceId: string;
      skillMarketplaceId: string;
      skillMarketplaceRepositoryId: string;
    }) =>
      withAuth(sdk =>
        sdk.skillMarketplaces.repositories.delete(
          i.instanceId,
          i.skillMarketplaceId,
          i.skillMarketplaceRepositoryId
        )
      )
  );

export let useSkillMarketplaceRepositories = (
  instanceId: string | null | undefined,
  skillMarketplaceId: string | null | undefined,
  query?: DashboardInstanceSkillsMarketplacesRepositoriesListQuery | null
) => {
  return usePaginator(
    pagination =>
      skillMarketplaceRepositoriesLoader.use(
        instanceId && skillMarketplaceId && query !== null
          ? { instanceId, skillMarketplaceId, ...pagination, ...(query ?? {}) }
          : null
      ),
    instanceId && skillMarketplaceId
      ? `${instanceId}:${skillMarketplaceId}:marketplaceRepositories:${JSON.stringify(
          query ?? {}
        )}`
      : null
  );
};

export let allSkillMarketplacePluginsLoader = createLoader({
  name: 'allSkillMarketplacePlugins',
  parents: [skillMarketplaceLoader, skillMarketplacePluginsLoader],
  fetch: (
    i: {
      instanceId: string;
      skillMarketplaceId: string;
    } & Omit<
      DashboardInstanceSkillsMarketplacesPluginsListQuery,
      'after' | 'before' | 'cursor'
    >
  ) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.skillMarketplaces.plugins.list(
          i.instanceId,
          i.skillMarketplaceId,
          normalizeSkillMarketplacePluginsListQuery({
            ...i,
            ...cursor,
            limit: i.limit ?? 100,
            order: i.order ?? 'asc'
          })
        )
      )
    ),
  mutators: {}
});

export let useAllSkillMarketplacePlugins = (
  instanceId: string | null | undefined,
  skillMarketplaceId: string | null | undefined,
  query?: Omit<
    DashboardInstanceSkillsMarketplacesPluginsListQuery,
    'after' | 'before' | 'cursor'
  > | null
) => {
  return allSkillMarketplacePluginsLoader.use(
    instanceId && skillMarketplaceId && query !== null
      ? {
          instanceId,
          skillMarketplaceId,
          ...(query ?? {})
        }
      : null
  );
};

export let skillMarketplaceEditorUrlLoader = createLoader({
  name: 'skillMarketplaceEditorUrl',
  parents: [],
  fetch: (i: { instanceId: string; skillMarketplaceId: string }) =>
    withAuth(sdk =>
      sdk.skillMarketplaces.getEditorUrl(i.instanceId, i.skillMarketplaceId, {})
    ),
  mutators: {}
});

export let useSkillMarketplaceEditorUrl = (
  instanceId: string | null | undefined,
  skillMarketplaceId: string | null | undefined
) => {
  let data = skillMarketplaceEditorUrlLoader.use(
    instanceId && skillMarketplaceId ? { instanceId, skillMarketplaceId } : null
  );

  useEffect(() => {
    let expiresAt = data.data?.expiresAt;
    if (!expiresAt) return;

    let expiresAtMs = new Date(expiresAt).getTime();
    let timeUntilExpiry = expiresAtMs - Date.now();

    if (timeUntilExpiry <= 0) {
      data.refetch();
      return;
    }

    let refreshIn = Math.max(5_000, timeUntilExpiry - 30_000);
    let timer = setTimeout(() => {
      data.refetch();
    }, refreshIn);

    return () => clearTimeout(timer);
  }, [data.data?.expiresAt]);

  return {
    ...data
  };
};

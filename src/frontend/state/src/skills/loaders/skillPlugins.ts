import type {
  DashboardInstanceSkillsPluginsCreateBody,
  DashboardInstanceSkillsPluginsGetEditorUrlOutput,
  DashboardInstanceSkillsPluginsGetOutput,
  DashboardInstanceSkillsPluginsListQuery,
  DashboardInstanceSkillsPluginsSkillsAddBody,
  DashboardInstanceSkillsPluginsSkillsGetOutput,
  DashboardInstanceSkillsPluginsSkillsListQuery,
  DashboardInstanceSkillsPluginsSkillsUpdateBody,
  DashboardInstanceSkillsPluginsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { useEffect } from 'react';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type SkillPlugin = DashboardInstanceSkillsPluginsGetOutput;
export type SkillPluginSkill = DashboardInstanceSkillsPluginsSkillsGetOutput;
export type SkillPluginEditorUrl = DashboardInstanceSkillsPluginsGetEditorUrlOutput;

let toArrayIfString = <T extends string>(value: T | T[] | undefined) =>
  typeof value === 'string' ? [value] : value;

let normalizeSkillPluginsListQuery = (
  query: DashboardInstanceSkillsPluginsListQuery
): DashboardInstanceSkillsPluginsListQuery => ({
  ...query,
  id: toArrayIfString(query.id),
  skillMarketplaceId: toArrayIfString(query.skillMarketplaceId),
  status: toArrayIfString(query.status),
  skillConfigurationId: toArrayIfString(query.skillConfigurationId)
});

let normalizeSkillPluginSkillsListQuery = (
  query: DashboardInstanceSkillsPluginsSkillsListQuery
): DashboardInstanceSkillsPluginsSkillsListQuery => ({
  ...query,
  id: toArrayIfString(query.id),
  skillId: toArrayIfString(query.skillId),
  status: toArrayIfString(query.status),
  skillConfigurationId: toArrayIfString(query.skillConfigurationId)
});

export let skillPluginsLoader = createLoader({
  name: 'skillPlugins',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSkillsPluginsListQuery) =>
    withAuth(sdk => sdk.skillsPlugins.list(i.instanceId, normalizeSkillPluginsListQuery(i))),
  mutators: {}
});

export let useCreateSkillPlugin = skillPluginsLoader.createExternalMutator(
  (i: DashboardInstanceSkillsPluginsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.skillsPlugins.create(i.instanceId, i))
);

export let useSkillPlugins = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSkillsPluginsListQuery | null
) => {
  return usePaginator(
    pagination =>
      skillPluginsLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    instanceId ? `${instanceId}:skillPlugins:${JSON.stringify(query ?? {})}` : null
  );
};

export let skillPluginLoader = createLoader({
  name: 'skillPlugin',
  parents: [skillPluginsLoader],
  fetch: (i: { instanceId: string; skillPluginId: string }) =>
    withAuth(sdk => sdk.skillsPlugins.get(i.instanceId, i.skillPluginId)),
  mutators: {
    update: (
      i: DashboardInstanceSkillsPluginsUpdateBody,
      {
        input: { instanceId, skillPluginId }
      }: { input: { instanceId: string; skillPluginId: string } }
    ) => withAuth(sdk => sdk.skillsPlugins.update(instanceId, skillPluginId, i)),

    delete: (
      _: void,
      {
        input: { instanceId, skillPluginId }
      }: { input: { instanceId: string; skillPluginId: string } }
    ) => withAuth(sdk => sdk.skillsPlugins.archive(instanceId, skillPluginId)),

    sync: (
      _: {},
      {
        input: { instanceId, skillPluginId }
      }: { input: { instanceId: string; skillPluginId: string } }
    ) => withAuth(sdk => sdk.skillsPlugins.sync(instanceId, skillPluginId, {}))
  }
});

export let useSkillPlugin = (
  instanceId: string | null | undefined,
  skillPluginId: string | null | undefined
) => {
  let data = skillPluginLoader.use(
    instanceId && skillPluginId ? { instanceId, skillPluginId } : null
  );

  return {
    ...data,
    updateMutator: data.useMutator('update'),
    deleteMutator: data.useMutator('delete'),
    syncMutator: data.useMutator('sync')
  };
};

export let skillPluginSkillsLoader = createLoader({
  name: 'skillPluginSkills',
  parents: [skillPluginLoader, skillPluginsLoader],
  fetch: (
    i: {
      instanceId: string;
      skillPluginId: string;
    } & DashboardInstanceSkillsPluginsSkillsListQuery
  ) =>
    withAuth(sdk =>
      sdk.skillsPlugins.skills.list(
        i.instanceId,
        i.skillPluginId,
        normalizeSkillPluginSkillsListQuery(i)
      )
    ),
  mutators: {}
});

export let useCreateSkillPluginSkill = skillPluginSkillsLoader.createExternalMutator(
  (
    i: DashboardInstanceSkillsPluginsSkillsAddBody & {
      instanceId: string;
      skillPluginId: string;
    }
  ) => withAuth(sdk => sdk.skillsPlugins.skills.add(i.instanceId, i.skillPluginId, i))
);

export let useUpdateSkillPluginSkill = skillPluginSkillsLoader.createExternalMutator(
  (
    i: DashboardInstanceSkillsPluginsSkillsUpdateBody & {
      instanceId: string;
      skillPluginId: string;
      skillPluginSkillId: string;
    }
  ) =>
    withAuth(sdk =>
      sdk.skillsPlugins.skills.update(i.instanceId, i.skillPluginId, i.skillPluginSkillId, i)
    )
);

export let useDeleteSkillPluginSkill = skillPluginSkillsLoader.createExternalMutator(
  (i: { instanceId: string; skillPluginId: string; skillPluginSkillId: string }) =>
    withAuth(sdk =>
      sdk.skillsPlugins.skills.remove(i.instanceId, i.skillPluginId, i.skillPluginSkillId)
    )
);

export let useSkillPluginSkills = (
  instanceId: string | null | undefined,
  skillPluginId: string | null | undefined,
  query?: DashboardInstanceSkillsPluginsSkillsListQuery | null
) => {
  return usePaginator(
    pagination =>
      skillPluginSkillsLoader.use(
        instanceId && skillPluginId && query !== null
          ? { instanceId, skillPluginId, ...pagination, ...(query ?? {}) }
          : null
      ),
    instanceId && skillPluginId
      ? `${instanceId}:${skillPluginId}:pluginSkills:${JSON.stringify(query ?? {})}`
      : null
  );
};

export let allSkillPluginSkillsLoader = createLoader({
  name: 'allSkillPluginSkills',
  parents: [skillPluginLoader, skillPluginSkillsLoader],
  fetch: (
    i: {
      instanceId: string;
      skillPluginId: string;
    } & Omit<DashboardInstanceSkillsPluginsSkillsListQuery, 'after' | 'before' | 'cursor'>
  ) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.skillsPlugins.skills.list(
          i.instanceId,
          i.skillPluginId,
          normalizeSkillPluginSkillsListQuery({
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

export let useAllSkillPluginSkills = (
  instanceId: string | null | undefined,
  skillPluginId: string | null | undefined,
  query?: Omit<
    DashboardInstanceSkillsPluginsSkillsListQuery,
    'after' | 'before' | 'cursor'
  > | null
) => {
  return allSkillPluginSkillsLoader.use(
    instanceId && skillPluginId && query !== null
      ? {
          instanceId,
          skillPluginId,
          ...(query ?? {})
        }
      : null
  );
};

export let skillPluginEditorUrlLoader = createLoader({
  name: 'skillPluginEditorUrl',
  parents: [],
  fetch: (i: { instanceId: string; skillPluginId: string }) =>
    withAuth(sdk => sdk.skillsPlugins.getEditorUrl(i.instanceId, i.skillPluginId, {})),
  mutators: {}
});

export let useSkillPluginEditorUrl = (
  instanceId: string | null | undefined,
  skillPluginId: string | null | undefined
) => {
  let data = skillPluginEditorUrlLoader.use(
    instanceId && skillPluginId ? { instanceId, skillPluginId } : null
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

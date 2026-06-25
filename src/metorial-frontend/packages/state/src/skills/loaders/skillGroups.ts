import type {
  DashboardInstanceSkillsCreateBody,
  DashboardInstanceSkillsGroupsCreateBody,
  DashboardInstanceSkillsGroupsGetOutput,
  DashboardInstanceSkillsGroupsItemsCreateBody,
  DashboardInstanceSkillsGroupsItemsGetOutput,
  DashboardInstanceSkillsGroupsItemsListQuery,
  DashboardInstanceSkillsGroupsListQuery,
  DashboardInstanceSkillsGroupsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader, useMutation } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type SkillGroup = DashboardInstanceSkillsGroupsGetOutput;
export type SkillGroupItem = DashboardInstanceSkillsGroupsItemsGetOutput;

let toArrayIfString = <T extends string>(value: T | T[] | undefined) =>
  typeof value === 'string' ? [value] : value;

let normalizeSkillGroupsListQuery = (
  query: DashboardInstanceSkillsGroupsListQuery
): DashboardInstanceSkillsGroupsListQuery => ({
  ...query,
  status: toArrayIfString(query.status),
  id: toArrayIfString(query.id),
  skillId: toArrayIfString(query.skillId)
});

let normalizeSkillGroupItemsListQuery = (
  query: DashboardInstanceSkillsGroupsItemsListQuery
): DashboardInstanceSkillsGroupsItemsListQuery => ({
  ...query,
  status: toArrayIfString(query.status),
  id: toArrayIfString(query.id),
  skillId: toArrayIfString(query.skillId)
});

export let skillGroupsLoader = createLoader({
  name: 'skillGroups',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSkillsGroupsListQuery) =>
    withAuth(sdk => sdk.skillGroups.list(i.instanceId, normalizeSkillGroupsListQuery(i))),
  mutators: {}
});

export let useCreateSkillGroup = skillGroupsLoader.createExternalMutator(
  (i: DashboardInstanceSkillsGroupsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.skillGroups.create(i.instanceId, i))
);

export let useUpdateSkillGroup = skillGroupsLoader.createExternalMutator(
  (
    i: DashboardInstanceSkillsGroupsUpdateBody & {
      instanceId: string;
      skillGroupId: string;
    }
  ) => withAuth(sdk => sdk.skillGroups.update(i.instanceId, i.skillGroupId, i))
);

export let useCreateSkillInGroup = () =>
  useMutation(
    (
      i: DashboardInstanceSkillsCreateBody & {
        instanceId: string;
        skillGroupId: string;
      }
    ) =>
      withAuth(sdk =>
        sdk.skills.create(i.instanceId, {
          ...i,
          skillGroupId: i.skillGroupId
        })
      ),
    {
      onSuccess: () => {
        skillGroupLoader.refetchAll();
        skillGroupsLoader.refetchAll();
      }
    }
  );

export let useSkillGroups = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSkillsGroupsListQuery | null
) => {
  return usePaginator(
    pagination =>
      skillGroupsLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    instanceId ? `${instanceId}:${JSON.stringify(query ?? {})}` : null
  );
};

export let skillGroupLoader = createLoader({
  name: 'skillGroup',
  parents: [skillGroupsLoader],
  fetch: (i: { instanceId: string; skillGroupId: string }) =>
    withAuth(sdk => sdk.skillGroups.get(i.instanceId, i.skillGroupId)),
  mutators: {
    update: (
      i: DashboardInstanceSkillsGroupsUpdateBody,
      {
        input: { instanceId, skillGroupId }
      }: { input: { instanceId: string; skillGroupId: string } }
    ) => withAuth(sdk => sdk.skillGroups.update(instanceId, skillGroupId, i)),

    delete: (
      _: void,
      {
        input: { instanceId, skillGroupId }
      }: { input: { instanceId: string; skillGroupId: string } }
    ) => withAuth(sdk => sdk.skillGroups.delete(instanceId, skillGroupId))
  }
});

export let useSkillGroup = (
  instanceId: string | null | undefined,
  skillGroupId: string | null | undefined
) => {
  let data = skillGroupLoader.use(
    instanceId && skillGroupId ? { instanceId, skillGroupId } : null
  );

  return {
    ...data,
    updateMutator: data.useMutator('update'),
    deleteMutator: data.useMutator('delete')
  };
};

export let skillGroupItemsLoader = createLoader({
  name: 'skillGroupItems',
  parents: [skillGroupLoader, skillGroupsLoader],
  fetch: (
    i: {
      instanceId: string;
      skillGroupId: string;
    } & DashboardInstanceSkillsGroupsItemsListQuery
  ) =>
    withAuth(sdk =>
      sdk.skillGroups.items.list(
        i.instanceId,
        i.skillGroupId,
        normalizeSkillGroupItemsListQuery(i)
      )
    ),
  mutators: {}
});

export let useCreateSkillGroupItem = () =>
  useMutation(
    (
      i: DashboardInstanceSkillsGroupsItemsCreateBody & {
        instanceId: string;
        skillGroupId: string;
      }
    ) => withAuth(sdk => sdk.skillGroups.items.create(i.instanceId, i.skillGroupId, i)),
    {
      onSuccess: () => {
        skillGroupItemsLoader.refetchAll();
        skillGroupLoader.refetchAll();
        skillGroupsLoader.refetchAll();
      }
    }
  );

export let useDeleteSkillGroupItem = () =>
  useMutation(
    (i: { instanceId: string; skillGroupId: string; skillGroupItemId: string }) =>
      withAuth(sdk =>
        sdk.skillGroups.items.delete(i.instanceId, i.skillGroupId, i.skillGroupItemId)
      ),
    {
      onSuccess: () => {
        skillGroupItemsLoader.refetchAll();
        skillGroupLoader.refetchAll();
        skillGroupsLoader.refetchAll();
      }
    }
  );

export let useRemoveSkillFromSkillGroup = () =>
  useMutation(
    async (i: { instanceId: string; skillGroupId: string; skillId: string }) => {
      let list = await withAuth(sdk =>
        sdk.skillGroups.items.list(i.instanceId, i.skillGroupId, {
          skillId: i.skillId,
          status: ['active'],
          limit: 1
        })
      );
      let item = list.items[0];
      if (!item) return null;

      return await withAuth(sdk =>
        sdk.skillGroups.items.delete(i.instanceId, i.skillGroupId, item.id)
      );
    },
    {
      onSuccess: () => {
        skillGroupItemsLoader.refetchAll();
        skillGroupLoader.refetchAll();
        skillGroupsLoader.refetchAll();
      }
    }
  );

// Quiet variants used by inline access toggles. They do not refetch any
// loaders on success so the caller can optimistically update local state
// without triggering global re-renders (e.g. sidebar) during the interaction.
export let useCreateSkillGroupItemQuiet = () =>
  useMutation(
    (
      i: DashboardInstanceSkillsGroupsItemsCreateBody & {
        instanceId: string;
        skillGroupId: string;
      }
    ) => withAuth(sdk => sdk.skillGroups.items.create(i.instanceId, i.skillGroupId, i))
  );

export let useRemoveSkillFromSkillGroupQuiet = () =>
  useMutation(async (i: { instanceId: string; skillGroupId: string; skillId: string }) => {
    let list = await withAuth(sdk =>
      sdk.skillGroups.items.list(i.instanceId, i.skillGroupId, {
        skillId: i.skillId,
        status: ['active'],
        limit: 1
      })
    );
    let item = list.items[0];
    if (!item) return null;

    return await withAuth(sdk =>
      sdk.skillGroups.items.delete(i.instanceId, i.skillGroupId, item.id)
    );
  });

// Caller-controlled refresh for skill group membership loaders. Use this after
// a batch of quiet mutations has settled so consumers (sidebars, group lists)
// catch up without competing with the user interaction.
export let refetchSkillGroupMembershipLoaders = () => {
  skillGroupItemsLoader.refetchAll();
  skillGroupLoader.refetchAll();
  skillGroupsLoader.refetchAll();
};

export let useSkillGroupItems = (
  instanceId: string | null | undefined,
  skillGroupId: string | null | undefined,
  query?: DashboardInstanceSkillsGroupsItemsListQuery | null
) => {
  return usePaginator(
    pagination =>
      skillGroupItemsLoader.use(
        instanceId && skillGroupId && query !== null
          ? { instanceId, skillGroupId, ...pagination, ...(query ?? {}) }
          : null
      ),
    instanceId && skillGroupId ? `${instanceId}:${skillGroupId}` : null
  );
};

export let allSkillGroupItemsLoader = createLoader({
  name: 'allSkillGroupItems',
  parents: [skillGroupLoader, skillGroupItemsLoader],
  fetch: (
    i: {
      instanceId: string;
      skillGroupId: string;
    } & Omit<DashboardInstanceSkillsGroupsItemsListQuery, 'after' | 'before' | 'cursor'>
  ) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.skillGroups.items.list(
          i.instanceId,
          i.skillGroupId,
          normalizeSkillGroupItemsListQuery({
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

export let useAllSkillGroupItems = (
  instanceId: string | null | undefined,
  skillGroupId: string | null | undefined,
  query?: Omit<
    DashboardInstanceSkillsGroupsItemsListQuery,
    'after' | 'before' | 'cursor'
  > | null
) => {
  return allSkillGroupItemsLoader.use(
    instanceId && skillGroupId && query !== null
      ? {
          instanceId,
          skillGroupId,
          ...(query ?? {})
        }
      : null
  );
};

export let skillGroupItemLoader = createLoader({
  name: 'skillGroupItem',
  parents: [skillGroupItemsLoader, skillGroupLoader],
  fetch: (i: { instanceId: string; skillGroupId: string; skillGroupItemId: string }) =>
    withAuth(sdk =>
      sdk.skillGroups.items.get(i.instanceId, i.skillGroupId, i.skillGroupItemId)
    ),
  mutators: {
    delete: (
      _: void,
      {
        input: { instanceId, skillGroupId, skillGroupItemId }
      }: {
        input: { instanceId: string; skillGroupId: string; skillGroupItemId: string };
      }
    ) =>
      withAuth(sdk => sdk.skillGroups.items.delete(instanceId, skillGroupId, skillGroupItemId))
  }
});

export let useSkillGroupItem = (
  instanceId: string | null | undefined,
  skillGroupId: string | null | undefined,
  skillGroupItemId: string | null | undefined
) => {
  let data = skillGroupItemLoader.use(
    instanceId && skillGroupId && skillGroupItemId
      ? { instanceId, skillGroupId, skillGroupItemId }
      : null
  );

  return {
    ...data,
    deleteMutator: data.useMutator('delete')
  };
};

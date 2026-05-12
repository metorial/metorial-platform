import type {
  DashboardInstanceSkillsCreateBody,
  DashboardInstanceSkillsDuplicateBody,
  DashboardInstanceSkillsForkBody,
  DashboardInstanceSkillsGetOutput,
  DashboardInstanceSkillsItemsCreateBody,
  DashboardInstanceSkillsItemsGetOutput,
  DashboardInstanceSkillsItemsListQuery,
  DashboardInstanceSkillsListQuery,
  DashboardInstanceSkillsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type Skill = DashboardInstanceSkillsGetOutput;
export type SkillItem = DashboardInstanceSkillsItemsGetOutput;

let toArrayIfString = <T extends string>(value: T | T[] | undefined) =>
  typeof value === 'string' ? [value] : value;

let normalizeSkillsListQuery = (
  query: DashboardInstanceSkillsListQuery
): DashboardInstanceSkillsListQuery => ({
  ...query,
  status: toArrayIfString(query.status)
});

let normalizeSkillItemsListQuery = (
  query: DashboardInstanceSkillsItemsListQuery
): DashboardInstanceSkillsItemsListQuery => ({
  ...query,
  status: toArrayIfString(query.status),
  type: toArrayIfString(query.type)
});

export let skillsLoader = createLoader({
  name: 'skills',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSkillsListQuery) =>
    withAuth(sdk => sdk.skills.list(i.instanceId, normalizeSkillsListQuery(i))),
  mutators: {}
});

export let useCreateSkill = skillsLoader.createExternalMutator(
  (i: DashboardInstanceSkillsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.skills.create(i.instanceId, i))
);

export let useForkSkill = skillsLoader.createExternalMutator(
  (i: DashboardInstanceSkillsForkBody & { instanceId: string; skillId: string }) =>
    withAuth(sdk => sdk.skills.fork(i.instanceId, i.skillId, i))
);

export let useDuplicateSkill = skillsLoader.createExternalMutator(
  (i: DashboardInstanceSkillsDuplicateBody & { instanceId: string; skillId: string }) =>
    withAuth(sdk => sdk.skills.duplicate(i.instanceId, i.skillId, i))
);

export let useSkills = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSkillsListQuery | null
) => {
  return usePaginator(
    pagination =>
      skillsLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    instanceId ? `${instanceId}:${JSON.stringify(query ?? {})}` : null
  );
};

export let skillLoader = createLoader({
  name: 'skill',
  parents: [skillsLoader],
  fetch: (i: { instanceId: string; skillId: string }) =>
    withAuth(sdk => sdk.skills.get(i.instanceId, i.skillId)),
  mutators: {
    update: (
      i: DashboardInstanceSkillsUpdateBody,
      { input: { instanceId, skillId } }: { input: { instanceId: string; skillId: string } }
    ) => withAuth(sdk => sdk.skills.update(instanceId, skillId, i)),

    delete: (
      _: void,
      { input: { instanceId, skillId } }: { input: { instanceId: string; skillId: string } }
    ) => withAuth(sdk => sdk.skills.delete(instanceId, skillId))
  }
});

export let useSkill = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined
) => {
  let data = skillLoader.use(instanceId && skillId ? { instanceId, skillId } : null);

  return {
    ...data,
    updateMutator: data.useMutator('update'),
    deleteMutator: data.useMutator('delete')
  };
};

export let skillItemsLoader = createLoader({
  name: 'skillItems',
  parents: [skillLoader, skillsLoader],
  fetch: (
    i: { instanceId: string; skillId: string } & DashboardInstanceSkillsItemsListQuery
  ) =>
    withAuth(sdk =>
      sdk.skills.items.list(i.instanceId, i.skillId, normalizeSkillItemsListQuery(i))
    ),
  mutators: {}
});

export let useCreateSkillItem = skillItemsLoader.createExternalMutator(
  (i: DashboardInstanceSkillsItemsCreateBody & { instanceId: string; skillId: string }) =>
    withAuth(sdk => sdk.skills.items.create(i.instanceId, i.skillId, i))
);

export let useDeleteSkillItem = skillItemsLoader.createExternalMutator(
  (i: { instanceId: string; skillId: string; skillItemId: string }) =>
    withAuth(sdk => sdk.skills.items.delete(i.instanceId, i.skillId, i.skillItemId))
);

export let useSkillItems = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined,
  query?: DashboardInstanceSkillsItemsListQuery | null
) => {
  return usePaginator(
    pagination =>
      skillItemsLoader.use(
        instanceId && skillId && query !== null
          ? { instanceId, skillId, ...pagination, ...(query ?? {}) }
          : null
      ),
    instanceId && skillId ? `${instanceId}:${skillId}` : null
  );
};

export let allSkillItemsLoader = createLoader({
  name: 'allSkillItems',
  parents: [skillLoader, skillItemsLoader],
  fetch: (
    i: {
      instanceId: string;
      skillId: string;
    } & Omit<DashboardInstanceSkillsItemsListQuery, 'after' | 'before' | 'cursor'>
  ) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.skills.items.list(
          i.instanceId,
          i.skillId,
          normalizeSkillItemsListQuery({
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

export let useAllSkillItems = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined,
  query?: Omit<DashboardInstanceSkillsItemsListQuery, 'after' | 'before' | 'cursor'> | null
) => {
  return allSkillItemsLoader.use(
    instanceId && skillId && query !== null
      ? {
          instanceId,
          skillId,
          ...(query ?? {})
        }
      : null
  );
};

export let skillItemLoader = createLoader({
  name: 'skillItem',
  parents: [skillItemsLoader, skillLoader],
  fetch: (i: { instanceId: string; skillId: string; skillItemId: string }) =>
    withAuth(sdk => sdk.skills.items.get(i.instanceId, i.skillId, i.skillItemId)),
  mutators: {
    delete: (
      _: void,
      {
        input: { instanceId, skillId, skillItemId }
      }: { input: { instanceId: string; skillId: string; skillItemId: string } }
    ) => withAuth(sdk => sdk.skills.items.delete(instanceId, skillId, skillItemId))
  }
});

export let useSkillItem = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined,
  skillItemId: string | null | undefined
) => {
  let data = skillItemLoader.use(
    instanceId && skillId && skillItemId ? { instanceId, skillId, skillItemId } : null
  );

  return {
    ...data,
    deleteMutator: data.useMutator('delete')
  };
};
